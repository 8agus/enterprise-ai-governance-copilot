import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

type GitHubTreeItem = {
  path: string;
  mode: string;
  type: "blob" | "tree" | string;
  sha: string;
  size?: number;
  url: string;
};

type GitHubRepoResponse = {
  default_branch: string;
};

type GitHubTreeResponse = {
  tree: GitHubTreeItem[];
  truncated: boolean;
};

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
};

type GitHubErrorResponse = {
  message?: string;
};

export type SampledRepoFile = {
  path: string;
  type: string;
  size: number | null;
  reasonSelected: string;
  content: string | null;
};

type RankedFile = SampledRepoFile & { score: number };

const MAX_SAMPLED_FILES = 20;
const MAX_CONTENT_BYTES = 30_000;

@Injectable()
export class GithubIngestionService {
  private readonly logger = new Logger(GithubIngestionService.name);

  async samplePolicyRelevantFiles(repoUrl: string): Promise<SampledRepoFile[]> {
    const { owner, repo } = this.parseOwnerRepo(repoUrl);
    this.logger.log(`[${owner}/${repo}] repo URL parsed`);

    const branch = await this.fetchDefaultBranch(owner, repo);
    this.logger.log(`[${owner}/${repo}] default branch fetched (${branch})`);

    const tree = await this.fetchRepositoryTree(owner, repo, branch);
    this.logger.log(`[${owner}/${repo}] repository tree fetched (${tree.length} entries)`);

    const ranked = tree
      .filter((item) => item.type === "blob")
      .map((item) => this.rankFile(item))
      .filter((item): item is RankedFile => item !== null)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, MAX_SAMPLED_FILES);

    this.logger.log(`[${owner}/${repo}] policy-relevant files ranked (${ranked.length})`);

    const sampled = await Promise.all(
      ranked.map(async (rankedFile) => ({
        path: rankedFile.path,
        type: rankedFile.type,
        size: rankedFile.size,
        reasonSelected: rankedFile.reasonSelected,
        content: await this.fetchFileContent(owner, repo, branch, rankedFile.path, rankedFile.size),
      })),
    );

    this.logger.log(`[${owner}/${repo}] files sampled (${sampled.length})`);

    return sampled;
  }

  private parseOwnerRepo(repoUrl: string): { owner: string; repo: string } {
    let url: URL;

    try {
      url = new URL(repoUrl);
    } catch {
      throw new BadRequestException("Invalid GitHub URL. Expected format: https://github.com/<owner>/<repo>");
    }

    if (url.hostname !== "github.com") {
      throw new BadRequestException("Invalid GitHub URL. Only github.com repository URLs are supported");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new BadRequestException("Invalid GitHub URL. Expected format: https://github.com/<owner>/<repo>");
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) {
      throw new BadRequestException("Invalid GitHub URL. Owner or repository name is missing");
    }

    return { owner, repo };
  }

  private async fetchDefaultBranch(owner: string, repo: string): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await fetch(url, {
      headers: this.githubHeaders(),
    });

    if (!response.ok) {
      throw await this.toGitHubHttpException(
        response,
        "Failed to fetch repository metadata from GitHub",
      );
    }

    const data = (await response.json()) as GitHubRepoResponse;
    if (!data.default_branch) {
      throw new ServiceUnavailableException("GitHub repository metadata did not include a default branch");
    }

    return data.default_branch;
  }

  private async fetchRepositoryTree(owner: string, repo: string, branch: string): Promise<GitHubTreeItem[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const response = await fetch(url, {
      headers: this.githubHeaders(),
    });

    if (!response.ok) {
      throw await this.toGitHubHttpException(response, "Failed to fetch repository files from GitHub");
    }

    const data = (await response.json()) as GitHubTreeResponse;
    if (!Array.isArray(data.tree)) {
      throw new ServiceUnavailableException("GitHub repository tree response is invalid");
    }

    return data.tree;
  }

  private async fetchFileContent(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    size: number | null,
  ): Promise<string | null> {
    if (typeof size === "number" && size > MAX_CONTENT_BYTES) {
      return null;
    }

    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
    const response = await fetch(url, {
      headers: this.githubHeaders(),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubContentResponse;
    if (data.encoding !== "base64" || typeof data.content !== "string") {
      return null;
    }

    try {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return decoded.slice(0, MAX_CONTENT_BYTES);
    } catch {
      return null;
    }
  }

  private rankFile(item: GitHubTreeItem): RankedFile | null {
    const path = item.path;
    const lowerPath = path.toLowerCase();
    const fileName = lowerPath.split("/").pop() ?? lowerPath;

    const checks: Array<{ test: boolean; score: number; reason: string }> = [
      {
        test: fileName.startsWith(".env"),
        score: 100,
        reason: "Environment file may contain secrets",
      },
      {
        test: ["readme.md", "package.json", "requirements.txt", "dockerfile"].includes(fileName),
        score: 90,
        reason: "Core project metadata or build config",
      },
      {
        test: /(policy|safety|guardrail|compliance|governance)/i.test(path),
        score: 80,
        reason: "Policy or safety-related file",
      },
      {
        test: /(config|settings|\.ya?ml$|\.toml$|\.ini$)/i.test(path),
        score: 70,
        reason: "Configuration file",
      },
      {
        test: /(prompt|openai|model|llm|ai)/i.test(path),
        score: 65,
        reason: "Potential AI-related configuration or prompts",
      },
      {
        test: /(secret|token|credential|password|key)/i.test(path),
        score: 60,
        reason: "Potential secret-related content",
      },
      {
        test: /(log|logger|audit)/i.test(path),
        score: 55,
        reason: "Potential logging or audit-related implementation",
      },
      {
        test: /\.(ts|tsx|js|jsx|py|java|cs|go|rb)$/i.test(path),
        score: 40,
        reason: "Source file potentially relevant for future checks",
      },
    ];

    const match = checks.find((check) => check.test);
    if (!match) {
      return null;
    }

    return {
      path,
      type: item.type,
      size: typeof item.size === "number" ? item.size : null,
      reasonSelected: match.reason,
      content: null,
      score: match.score,
    };
  }

  private githubHeaders(): Record<string, string> {
    const token = process.env.GITHUB_TOKEN?.trim();

    return token
      ? {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "enterprise-ai-governance-copilot",
        }
      : {
          Accept: "application/vnd.github+json",
          "User-Agent": "enterprise-ai-governance-copilot",
        };
  }

  private async toGitHubHttpException(response: Response, context: string): Promise<HttpException> {
    const githubMessage = await this.extractGitHubErrorMessage(response);
    const detail = githubMessage ? `: ${githubMessage}` : "";

    if (response.status === 404) {
      return new BadRequestException(
        `GitHub repository not found or not accessible${detail}. Verify repository URL and visibility.`,
      );
    }

    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
      return new HttpException(
        "GitHub API rate limit reached. Set GITHUB_TOKEN in the API environment and retry.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (response.status === 403) {
      return new BadRequestException(
        `GitHub access denied${detail}. Check repository visibility and token permissions if using GITHUB_TOKEN.`,
      );
    }

    if (response.status >= 500) {
      return new ServiceUnavailableException(`GitHub API is temporarily unavailable${detail}.`);
    }

    return new BadRequestException(`${context} (${response.status})${detail}`);
  }

  private async extractGitHubErrorMessage(response: Response): Promise<string | null> {
    try {
      const body = (await response.json()) as GitHubErrorResponse;
      return typeof body.message === "string" ? body.message : null;
    } catch {
      return null;
    }
  }
}

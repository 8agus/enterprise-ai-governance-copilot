import { Injectable } from "@nestjs/common";

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

export type SampledRepoFile = {
  path: string;
  type: string;
  size: number | null;
  reasonSelected: string;
};

type RankedFile = SampledRepoFile & { score: number };

const MAX_SAMPLED_FILES = 20;

@Injectable()
export class GithubIngestionService {
  async samplePolicyRelevantFiles(repoUrl: string): Promise<SampledRepoFile[]> {
    const { owner, repo } = this.parseOwnerRepo(repoUrl);
    const branch = await this.fetchDefaultBranch(owner, repo);
    const tree = await this.fetchRepositoryTree(owner, repo, branch);

    const ranked = tree
      .filter((item) => item.type === "blob")
      .map((item) => this.rankFile(item))
      .filter((item): item is RankedFile => item !== null)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, MAX_SAMPLED_FILES)
      .map(({ score, ...file }) => file);

    return ranked;
  }

  private parseOwnerRepo(repoUrl: string): { owner: string; repo: string } {
    let url: URL;

    try {
      url = new URL(repoUrl);
    } catch {
      throw new Error("Invalid GitHub URL. Expected format: https://github.com/<owner>/<repo>");
    }

    if (url.hostname !== "github.com") {
      throw new Error("Invalid GitHub URL. Only github.com repository URLs are supported");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new Error("Invalid GitHub URL. Expected format: https://github.com/<owner>/<repo>");
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL. Owner or repository name is missing");
    }

    return { owner, repo };
  }

  private async fetchDefaultBranch(owner: string, repo: string): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "enterprise-ai-governance-copilot" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repository metadata from GitHub (${response.status})`);
    }

    const data = (await response.json()) as GitHubRepoResponse;
    if (!data.default_branch) {
      throw new Error("GitHub repository metadata did not include a default branch");
    }

    return data.default_branch;
  }

  private async fetchRepositoryTree(owner: string, repo: string, branch: string): Promise<GitHubTreeItem[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "enterprise-ai-governance-copilot" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repository files from GitHub (${response.status})`);
    }

    const data = (await response.json()) as GitHubTreeResponse;
    if (!Array.isArray(data.tree)) {
      throw new Error("GitHub repository tree response is invalid");
    }

    return data.tree;
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
      score: match.score,
    };
  }
}

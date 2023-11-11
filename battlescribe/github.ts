import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { filename } from "~/electron/node_helpers";
import type { BattleScribeRepoData } from "~/assets/shared/battlescribe/bs_import_data";
import { removeSuffix } from "~/assets/shared/battlescribe/bs_helpers";
export interface GithubIntegration {
  githubUrl: string;
  githubRepo: string;
  githubOwner: string;
  githubName: string;
  repoData?: BattleScribeRepoData;
  discovered?: boolean;
}

export function normalizeGithubRepoUrl(input: string): string | null {
  const githubUrlRegex = /^(?:(http(s?)?:\/\/)?github.com\/)?([^\/]+)\/([^\/]+)$/;
  const match = input.match(githubUrlRegex);

  if (!match) {
    return null;
  }

  const [, protocol = "https://", _, user, repo] = match;

  if (!user || !repo) {
    return null;
  }
  return `https://github.com/${user}/${repo}`;
}
export function parseGitHubUrl(githubUrl: string) {
  // Regular expression to match GitHub URLs
  const githubUrlRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/)?$/;

  // Check if the input URL matches the GitHub URL format
  const match = githubUrl.match(githubUrlRegex);

  if (!match) {
    throw new Error("Invalid GitHub URL format: " + githubUrl);
  }

  const [, repoOwner, repoName] = match;

  return {
    githubUrl: githubUrl,
    githubRepo: `${repoOwner}/${repoName}`,
    githubOwner: repoOwner,
    githubName: repoName,
  };
}

// Example usage:
const githubUrl = "https://github.com/octocat/hello-world";
const githubInfo = parseGitHubUrl(githubUrl);
console.log(githubInfo);

async function getFileContentFromRepo(githubUrl: string, filePath: string) {
  try {
    const urlParts = githubUrl.split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1].replace(".git", "");
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;

    console.log(`Querying github api at ${url}`);
    const response = await $fetch<{ download_url?: string }>(url, {
      headers: {
        "User-Agent": "New Recruit Data Editor (Electron)",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response || !response?.download_url) {
      throw new Error("No download_url found");
    }
    console.log(`Downloading file at ${response?.download_url}`);

    const content = await $fetch<string>(response.download_url, {
      headers: {
        "User-Agent": "New Recruit Data Editor (Electron)",
        Accept: "application/vnd.github.v3+json",
      },
    });
    console.log(`Downloaded file, length: ${content.length}`);
    return content;
  } catch (error) {
    throw error;
  }
}
async function getFileContentFromRepoWithFallback(githubUrl: string, filePath: string, fallBackPath?: string) {
  try {
    return await getFileContentFromRepo(githubUrl, filePath);
  } catch (error) {
    if (!fallBackPath) {
      throw error;
    }
    return await getFileContentFromRepo(githubUrl, fallBackPath);
  }
}

export async function getNextRevision(github: GithubIntegration, catalogue: Catalogue) {
  if (catalogue.fullFilePath) {
    try {
      const fileName = filename(catalogue.fullFilePath);
      const fallBack = fileName.endsWith("z") ? removeSuffix(fileName, "z") : undefined;
      const content = await getFileContentFromRepoWithFallback(github.githubUrl, fileName, fallBack);
      const regex = /revision="(\d+)"/;
      const match = content.match(regex);
      if (match) {
        const resultRevision = (Number(match[1]) || 0) + 1;
        console.log(`Revision of ${catalogue.name}: ${catalogue.revision} -> ${resultRevision}`);
        return resultRevision;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return catalogue.revision || 1;
}

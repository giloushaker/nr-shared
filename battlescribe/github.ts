import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { filename } from "~/electron/node_helpers";
import type { BattleScribeRepoData } from "~/assets/shared/battlescribe/bs_import_data";
import { removeSuffix } from "~/assets/shared/battlescribe/bs_helpers";
import { XMLParser } from "fast-xml-parser";
export interface GithubIntegration {
  githubUrl: string;
  githubRepo?: string;
  githubOwner?: string;
  githubName?: string;
  repoData?: BattleScribeRepoData;
  discovered?: boolean;
}
const headers = {
  'Accept': 'application/vnd.github.v3+json',
} as Record<string, string>;
if (process?.env?.githubToken) {
  headers["Authorization"] = `Bearer ${process.env.githubToken}`
}

function throwIfError(response: { message?: string }) {
  if (response.message) throw new Error(response.message);
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
export async function fetchRef(owner: string, repo: string, ref: string): Promise<{ ref: string | null, sha?: string; name?: string, date?: string }> {
  switch (ref) {
    case "latest-commit": {
      const { sha } = await getTree(owner, repo, "HEAD");
      return { ref: sha, sha: sha }
    }
    case "latest-tag":
    case "TAG_HEAD": {
      const tagsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`, { headers });
      const tags = await tagsResponse.json();
      throwIfError(tags)
      const latestTagSha = tags[0]?.commit?.sha;
      if (!latestTagSha) {
        throw new Error("Repo has no releases/tags, use latest commit (Head)")
      }
      return { ref: tags[0].name, name: tags[0].name, sha: latestTagSha }
    }
    case "latest-release-or-commit": {
      const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers })
      if (releaseResponse.status !== 404) {
        const release = await releaseResponse.json()
        throwIfError(release)
        const tag = release.tag_name
        return { ref: tag, name: tag, date: release.published_at };
      }
      const { sha } = await getTree(owner, repo, "HEAD");
      return { ref: sha, sha }
    }
    case "latest-release-atom": {
      const atomResponse = await fetch(`https://github.com/${owner}/${repo}/releases.atom`)
      const atomXml = await atomResponse.text()
      function parseValue(str: string): any {
        switch (str) {
          case "true": return true;
          case "false": return false;
          default:
            if (isNaN(str as any)) return str;
            const float = parseFloat(str);
            if (isFinite(float) && str.includes("+") == false) return float;
            return str;
        }
      }
      const options = {
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        attributeNamePrefix: "",
        textNodeName: "$text",
        processEntities: false,
        parseTagValue: false,
        ignoreDeclaration: true,
        alwaysCreateTextNode: false,

        isArray: (tagName: string, jPath: string, isLeafNode: boolean, isAttribute: boolean) => {
          return !isAttribute && ["entry", "link"].includes(tagName)
        },
        attributeValueProcessor: (name: string, val: string) => {
          return parseValue(unescape(val))
        },
        tagValueProcessor: (name: string, val: string) => {
          return unescape(val)
        },
      };
      const parsed = new XMLParser(options).parse(atomXml);
      if (!parsed.feed?.entry?.length) {
        return { ref: null }
      } else {
        const entry = parsed.feed.entry[0]
        const tag = entry.id.split('/').pop()
        return { ref: tag, name: tag }
      }
    }
    case "latest-release":
    case "RELEASE_HEAD":
      const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers })
      const release = await releaseResponse.json()
      throwIfError(release)
      const tag = release.tag_name
      return { ref: tag, name: tag, date: release.published_at };
    default:
      return { ref: ref }
  }
}
export async function getBlob(url: string) {
  const resp = await fetch(url, { headers })
  const json = await resp.json()
  throwIfError(json)
  json.content = atob(json.content)
  delete json.encoding
  return json
}
export async function getCommit(owner: string, repo: string, sha: string) {
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, { headers })
  const json = await resp.json()
  throwIfError(json)
  return json
}
export async function getCommitDate(owner: string, repo: string, sha: string) {
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, { headers })
  const json = await resp.json()
  throwIfError(json)
  return json.commit.committer.date

}
export async function findLatestCommitDate(owner: string, repo: string, path: string, commitSha: string, blobSha: string) {
  const apiUrlBase = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    // List commits affecting the file up to the commit resolved from the tag
    const response = await fetch(`${apiUrlBase}/commits?path=${path}&sha=${commitSha}`, { headers });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const commits = await response.json();
    throwIfError(commits)

    // Check each commit for the blob SHA (This part is not fully implemented here)
    for (let commit of commits) {
      let commitResponse = await fetch(`${apiUrlBase}/git/trees/${commit.sha}`, { headers });
      if (!commitResponse.ok) continue; // Skip on error
      let commitData = await commitResponse.json();
      throwIfError(commitData)

      // You would need to traverse the tree to find the file and check its blob SHA
      // This part is simplified and needs proper tree traversal depending on repository structure
      if (commitData.tree.some((entry: { path?: string, sha?: string }) => entry.path === path && entry.sha === blobSha)) {
        return commit.commit.committer.date
      }
    }
    return 'No matching commit found';
  } catch (error) {
    console.error('Error fetching commit data:', error);
    return null;
  }
}

export interface GitTreeFile {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
}

export interface GitTree {
  sha: string;
  url: string;
  truncated: boolean;
  tree: GitTreeFile[];
}

export async function getTree(owner: string, repo: string, ref: string): Promise<GitTree> {
  const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}`, { headers });
  const tree = await treeResponse.json();
  throwIfError(tree)
  return tree;
}


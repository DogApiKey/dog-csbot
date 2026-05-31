import type { Database } from "../db/index.ts";
import { documents } from "../db/schema.ts";
import { eq, and } from "drizzle-orm";
import type { IngestPipeline } from "../rag/ingest.ts";

export interface GitHubFile {
  path: string;
  name: string;
  content: string;
  sha: string;
  url: string;
}

export interface SyncOptions {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  token?: string;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

/**
 * Service for syncing knowledge base documents from a GitHub repository.
 */
export class GitHubSyncService {
  private db: Database;
  private ingestPipeline: IngestPipeline;

  constructor(db: Database, ingestPipeline: IngestPipeline) {
    this.db = db;
    this.ingestPipeline = ingestPipeline;
  }

  /**
   * Sync documents from a GitHub repository.
   */
  async sync(options: SyncOptions): Promise<SyncResult> {
    const { owner, repo, branch = "main", path = "", token } = options;
    const result: SyncResult = { synced: 0, created: 0, updated: 0, deleted: 0, errors: [] };

    try {
      // Fetch all Markdown files from the repo
      const files = await this.fetchMarkdownFiles(owner, repo, branch, path, token);
      result.synced = files.length;

      // Process each file
      for (const file of files) {
        try {
          const sourceUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${file.path}`;

          // Check if document already exists
          const [existing] = await this.db
            .select()
            .from(documents)
            .where(
              and(
                eq(documents.source, sourceUrl),
              ),
            )
            .limit(1);

          if (existing) {
            // Update if content changed
            if (existing.content !== file.content) {
              await this.ingestPipeline.delete(existing.id);
              await this.ingestPipeline.ingest({
                title: this.generateTitle(file.name, file.path),
                content: file.content,
                source: sourceUrl,
                metadata: {
                  repo: `${owner}/${repo}`,
                  branch,
                  path: file.path,
                  sha: file.sha,
                  syncedAt: new Date().toISOString(),
                },
              });
              result.updated++;
            }
          } else {
            // Create new document
            await this.ingestPipeline.ingest({
              title: this.generateTitle(file.name, file.path),
              content: file.content,
              source: sourceUrl,
              metadata: {
                repo: `${owner}/${repo}`,
                branch,
                path: file.path,
                sha: file.sha,
                syncedAt: new Date().toISOString(),
              },
            });
            result.created++;
          }
        } catch (error) {
          const msg = `Failed to sync ${file.path}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(msg);
          console.error(msg);
        }
      }

      return result;
    } catch (error) {
      const msg = `Failed to fetch repository: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(msg);
      throw new Error(msg);
    }
  }

  /**
   * Fetch all Markdown files from a GitHub repository.
   */
  private async fetchMarkdownFiles(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    token?: string,
  ): Promise<GitHubFile[]> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Get the tree recursively
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const treeResponse = await fetch(treeUrl, { headers });

    if (!treeResponse.ok) {
      throw new Error(`GitHub API error: ${treeResponse.status} ${treeResponse.statusText}`);
    }

    const tree = (await treeResponse.json()) as {
      tree: Array<{ path: string; type: string; sha: string; url: string }>;
    };

    // Filter for Markdown files
    const mdFiles = tree.tree.filter(
      (item) =>
        item.type === "blob" &&
        item.path.endsWith(".md") &&
        (path === "" || item.path.startsWith(path)),
    );

    // Fetch content for each file
    const files: GitHubFile[] = [];
    for (const file of mdFiles) {
      try {
        const contentUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
        const contentResponse = await fetch(contentUrl, { headers });

        if (contentResponse.ok) {
          const content = await contentResponse.text();
          files.push({
            path: file.path,
            name: file.path.split("/").pop() ?? file.path,
            content,
            sha: file.sha,
            url: file.url,
          });
        }
      } catch (error) {
        console.error(`Failed to fetch ${file.path}:`, error);
      }
    }

    return files;
  }

  /**
   * Generate a human-readable title from filename and path.
   */
  private generateTitle(name: string, path: string): string {
    // Remove .md extension
    const baseName = name.replace(/\.md$/i, "");

    // Use directory name as prefix if nested
    const parts = path.split("/");
    if (parts.length > 1) {
      const dir = parts[parts.length - 2];
      return `${dir} / ${baseName}`;
    }

    return baseName;
  }
}

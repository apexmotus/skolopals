import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_STORAGE_CLIENT,
  type StorageBucket,
} from './file-storage.constants.js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

/**
 * Narrow wrapper around the private buckets in STORAGE_BUCKETS. Browsers
 * upload and download through signed URLs only; the API itself touches bytes
 * solely to check and convert an upload (`download` / `upload`), never to
 * serve one. Fully mockable: tests inject a fake `SupabaseClient` via
 * `SUPABASE_STORAGE_CLIENT`, never hitting the network.
 */
@Injectable()
export class FileStorageService {
  constructor(
    @Inject(SUPABASE_STORAGE_CLIENT) private readonly client: SupabaseClient,
  ) {}

  async createUploadUrl(
    bucket: StorageBucket,
    path: string,
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (error)
      throw new Error(
        `Failed to create signed upload URL for "${bucket}/${path}": ${error.message}`,
      );
    return data;
  }

  async createDownloadUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error)
      throw new Error(
        `Failed to create signed download URL for "${bucket}/${path}": ${error.message}`,
      );
    return data.signedUrl;
  }

  /** Reads an object so its contents can be checked. `null` when it does not exist. */
  async download(bucket: StorageBucket, path: string): Promise<Buffer | null> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .download(path);
    if (error) {
      if (/not.?found|404/i.test(error.message)) return null;
      throw new Error(
        `Failed to download "${bucket}/${path}": ${error.message}`,
      );
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async upload(
    bucket: StorageBucket,
    path: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: false });
    if (error)
      throw new Error(`Failed to upload "${bucket}/${path}": ${error.message}`);
  }

  async move(bucket: StorageBucket, from: string, to: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).move(from, to);
    if (error)
      throw new Error(
        `Failed to move "${bucket}/${from}" to "${to}": ${error.message}`,
      );
  }

  async remove(bucket: StorageBucket, paths: string[]): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error)
      throw new Error(
        `Failed to remove file(s) [${paths.join(', ')}] from "${bucket}": ${error.message}`,
      );
  }
}

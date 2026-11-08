import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_STORAGE_CLIENT,
  TUTOR_DOCUMENTS_BUCKET,
} from './file-storage.constants.js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

/**
 * Narrow wrapper around the `tutor-documents` bucket — signed upload/download
 * URLs only, never raw bytes through this API. First real consumer is the
 * `tutors` module (Phase 3a). Fully mockable: tests inject a fake
 * `SupabaseClient` via `SUPABASE_STORAGE_CLIENT`, never hitting the network.
 */
@Injectable()
export class FileStorageService {
  constructor(
    @Inject(SUPABASE_STORAGE_CLIENT) private readonly client: SupabaseClient,
  ) {}

  async createUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const { data, error } = await this.client.storage
      .from(TUTOR_DOCUMENTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error)
      throw new Error(
        `Failed to create signed upload URL for "${path}": ${error.message}`,
      );
    return data;
  }

  async createDownloadUrl(
    path: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(TUTOR_DOCUMENTS_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error)
      throw new Error(
        `Failed to create signed download URL for "${path}": ${error.message}`,
      );
    return data.signedUrl;
  }

  async remove(paths: string[]): Promise<void> {
    const { error } = await this.client.storage
      .from(TUTOR_DOCUMENTS_BUCKET)
      .remove(paths);
    if (error)
      throw new Error(
        `Failed to remove file(s) [${paths.join(', ')}]: ${error.message}`,
      );
  }
}

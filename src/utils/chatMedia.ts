export interface UploadedMediaInfo {
  /**
   * Stored value/key that the backend expects as mediaUrl in send_message payloads.
   * On mobile this is typically filename/key rather than a full URL.
   */
  storedValue: string | null;
  /**
   * Optional full URL if the upload endpoint returns it directly.
   */
  url: string | null;
}

/**
 * Extract a stable stored value and optional URL from a media upload response.
 *
 * This mirrors the mobile logic by being defensive about the response shape:
 * - Accepts { success, data: { filename, key, fileKey, url, fileUrl } }
 * - Accepts plain { filename, key, fileKey, url, fileUrl }
 * - Falls back through several common field names.
 */
export const extractUploadedMedia = (uploadResp: any): UploadedMediaInfo => {
  if (!uploadResp) {
    return { storedValue: null, url: null };
  }

  // If the response is wrapped in a success/data envelope, unwrap it first
  const top = uploadResp && uploadResp.success !== undefined ? uploadResp : uploadResp?.data ?? uploadResp;
  const inner = top?.data ?? top;

  const filename =
    inner?.filename ??
    inner?.fileName ??
    inner?.key ??
    inner?.fileKey ??
    null;

  const url =
    inner?.url ??
    inner?.fileUrl ??
    inner?.mediaUrl ??
    null;

  // Prefer a stable stored key/value; if not present, fall back to URL
  const storedValue = filename || url || null;

  return {
    storedValue,
    url,
  };
};


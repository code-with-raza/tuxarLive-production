export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const candidate = error as { message?: string; context?: Response } | null;
  if (candidate?.context instanceof Response) {
    try {
      const body = await candidate.context.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
      if (typeof body?.message === "string" && body.message.trim()) return body.message;
    } catch {
      // The function may have returned a non-JSON gateway error.
    }
  }
  return candidate?.message || fallback;
}

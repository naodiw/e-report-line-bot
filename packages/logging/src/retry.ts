export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  isRetryable?: (error: unknown) => boolean;
}

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  let currentError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      currentError = error;
      const retryable = options.isRetryable ? options.isRetryable(error) : true;
      if (!retryable || attempt === options.attempts) {
        throw currentError;
      }

      await wait(options.baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw currentError;
};

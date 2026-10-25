import { BackendError } from "@/lib/services/backend-client";

export function onboardingErrorMessage(err: unknown): string {
  if (err instanceof BackendError) {
    switch (err.code) {
      case "WORKFLOW_NOT_CONFIGURED":
        return "Verification isn't configured yet. Use the demo option below.";
      case "EMAIL_IN_USE":
        return "That email already has a Launchpad account.";
      case "VERIFICATION_ALREADY_CLAIMED":
        return "This verification already belongs to another email.";
      case "CLAIM_TOKEN_INVALID":
      case "VERIFICATION_NOT_FOUND":
        return "This verification session is no longer valid. Start again.";
      case "BACKEND_UNREACHABLE":
        return "The Neko backend is not reachable.";
      case "VALIDATION_ERROR":
        return "Check the details you entered and try again.";
      default:
        return err.message;
    }
  }
  return "Something went wrong. Try again.";
}

export function isDeadSession(err: unknown): boolean {
  return (
    err instanceof BackendError && (err.status === 401 || err.status === 404)
  );
}

/**
 * Error code enum for consistent, deterministic error classification
 */
export enum SimulationErrorCode {
  INVALID_CONTRACT_OPERATION = "INVALID_CONTRACT_OPERATION",
  INVALID_INPUT = "INVALID_INPUT",
  AUTHORIZATION_REQUIRED = "AUTHORIZATION_REQUIRED",
  MISSING_STATE_ENTRY = "MISSING_STATE_ENTRY",
  BUDGET_EXCEEDED = "BUDGET_EXCEEDED",
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
  CONTRACT_NOT_FOUND = "CONTRACT_NOT_FOUND",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  TRANSACTION_TOO_LARGE = "TRANSACTION_TOO_LARGE",
  RESTORE_REQUIRED = "RESTORE_REQUIRED",
  RPC_ERROR = "RPC_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface MappedSimulationError {
  errorCode: SimulationErrorCode;
  userMessage: string;
  technicalError: string;
  details?: Record<string, unknown>;
}

interface ErrorPattern {
  pattern: RegExp;
  errorCode: SimulationErrorCode;
  message: string;
}

const KNOWN_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /HostError.*Error.*WasmVm.*InvalidAction/i,
    errorCode: SimulationErrorCode.INVALID_CONTRACT_OPERATION,
    message:
      "The smart contract encountered an invalid operation. The transaction parameters may be incorrect.",
  },
  {
    pattern: /HostError.*Error.*Value.*InvalidInput/i,
    errorCode: SimulationErrorCode.INVALID_INPUT,
    message:
      "One or more input values are invalid for this contract operation.",
  },
  {
    pattern: /HostError.*Error.*Auth.*NotAuthorized/i,
    errorCode: SimulationErrorCode.AUTHORIZATION_REQUIRED,
    message:
      "This operation requires authorization from an account that has not been provided.",
  },
  {
    pattern: /HostError.*Error.*Storage.*MissingValue/i,
    errorCode: SimulationErrorCode.MISSING_STATE_ENTRY,
    message:
      "A required contract state entry does not exist. The escrow or resource may not have been initialized.",
  },
  {
    pattern: /HostError.*Error.*Budget.*ExceededLimit/i,
    errorCode: SimulationErrorCode.BUDGET_EXCEEDED,
    message:
      "The transaction exceeds computational limits. Try simplifying the operation or splitting it.",
  },
  {
    pattern: /account.*does not exist/i,
    errorCode: SimulationErrorCode.ACCOUNT_NOT_FOUND,
    message:
      "The source account does not exist on the network. Ensure it is funded and activated.",
  },
  {
    pattern: /contract.*does not exist/i,
    errorCode: SimulationErrorCode.CONTRACT_NOT_FOUND,
    message:
      "The specified contract does not exist on this network. Check the contract ID.",
  },
  {
    pattern: /insufficient.*balance/i,
    errorCode: SimulationErrorCode.INSUFFICIENT_BALANCE,
    message:
      "The account has insufficient balance to cover fees for this transaction.",
  },
  {
    pattern: /transaction.*too large/i,
    errorCode: SimulationErrorCode.TRANSACTION_TOO_LARGE,
    message:
      "The transaction is too large. Consider reducing the complexity of the operation.",
  },
];

export function mapSimulationError(rawError: string): MappedSimulationError {
  for (const { pattern, errorCode, message } of KNOWN_ERROR_PATTERNS) {
    if (pattern.test(rawError)) {
      return {
        errorCode,
        userMessage: message,
        technicalError: rawError,
      };
    }
  }

  // Parse HostError codes if present
  const hostErrorMatch = rawError.match(/Error\((\w+),\s*(\w+)\)/);
  if (hostErrorMatch) {
    return {
      errorCode: SimulationErrorCode.INVALID_CONTRACT_OPERATION,
      userMessage: `Contract execution failed with error type "${hostErrorMatch[1]}". Please verify the transaction parameters and try again.`,
      technicalError: rawError,
      details: {
        errorType: hostErrorMatch[1],
        errorCode: hostErrorMatch[2],
      } as Record<string, unknown>,
    };
  }

  return {
    errorCode: SimulationErrorCode.UNKNOWN_ERROR,
    userMessage:
      "The transaction simulation failed. Please check your parameters and try again.",
    technicalError: rawError,
  };
}

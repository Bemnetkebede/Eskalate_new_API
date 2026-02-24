export interface BaseResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}

export interface PaginatedResponse<T> extends BaseResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export class ResponseProvider {
  static success<T>(data?: T, message?: string): BaseResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  static paginated<T>(data: T[], total: number, page: number, limit: number, message?: string): PaginatedResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  static error(error: any, message?: string): BaseResponse<null> {
    return {
      success: false,
      message,
      error,
    };
  }
}

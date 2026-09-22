export interface IApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}

export interface IServiceResponse{
  success:boolean;
  code : number;
  message:string;



}

export interface IPaginationParams {
    page: number;
    limit: number;
}

export interface IPaginatedResponse<T> {
    success: boolean;
    message: string;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

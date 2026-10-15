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

export interface IFieldError {
  field: string;
  message: string;
}

import axios from 'axios';






export abstract class BaseProvider {
  protected name: string;
  protected baseUrl: string;
  protected apiKey: string;
  protected secretKey?: string;

  constructor(name: string, baseUrl: string, apiKey: string, secretKey?: string) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.secretKey = secretKey;
  }



  protected getCustomHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
    };
  }

  protected async makeRequest(endpoint: string, data: any, method: 'POST' | 'GET' = 'POST'): Promise<any> {
   
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...this.getCustomHeaders(),
        },
        ...(method === 'POST' && { data }),
      };

      const response = await axios(config);
      


      return response.data;
    } catch (error: any) {



      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  protected abstract getAuthHeader(): string;
  protected abstract getAccessToken(): string;

}

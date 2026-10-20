declare module "@clerk/backend" {
  export function verifyToken(
    token: string,
    options: {
      secretKey?: string;
      jwtKey?: string;
      authorizedParties?: string[];
      issuer?: string;
    }
  ): Promise<{ sub: string; [key: string]: any }>;

  export function createClerkClient(options: { secretKey?: string; publishableKey?: string }): any;
}

interface Window {
  google: {
    accounts: {
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (response: {
            access_token?: string;
            expires_in?: number;
            error?: string;
          }) => void;
        }): { requestAccessToken(overrides?: { prompt?: string }): void };
        revoke(token: string, done: () => void): void;
      };
    };
  };
  __DRIVE_CLIENT_ID?: string;
}

declare module "imap-simple" {
  interface IMAPConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    authTimeout?: number;
  }

  interface IMAPConnection {
    openBox(boxName: string): Promise<void>;
    search(criteria: any[], fetchOptions: any): Promise<any[]>;
    end(): Promise<void>;
  }

  function connect(config: { imap: IMAPConfig; onmail?: (numNewMsgs: number) => void }): Promise<IMAPConnection>;
  
  export = { connect };
}

declare module "mailparser" {
  interface ParsedMail {
    subject?: string;
    from?: { text: string };
    text?: string;
    html?: string;
  }
  
  function simpleParser(source: string | Buffer): Promise<ParsedMail>;
}

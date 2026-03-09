export type A2AMessage = {
  id: string;
  ts: string;
  from: string;
  to: string;
  type: string;
  payload: any;
};

export class A2ABus {
  private handlers: Record<string, (msg: A2AMessage) => Promise<any>> = {};
  public messages: A2AMessage[] = [];

  register(agentName: string, handler: (msg: A2AMessage) => Promise<any>) {
    this.handlers[agentName] = handler;
  }

  async send(msg: A2AMessage): Promise<any> {
    this.messages.push(msg);
    const handler = this.handlers[msg.to];
    if (!handler) throw new Error(`No handler registered for agent: ${msg.to}`);
    return handler(msg);
  }
}

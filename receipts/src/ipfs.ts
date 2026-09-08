import type { Receipt } from "./index.js";

export interface IpfsClient {
  pinReceipt(receipt: Receipt): Promise<{ cid: string; url: string }>;
  fetchReceipt(cid: string): Promise<Receipt | null>;
}

export class Web3StorageIpfsClient implements IpfsClient {
  private token: string;
  private endpoint: string;

  constructor(token: string, endpoint = "https://api.web3.storage") {
    this.token = token;
    this.endpoint = endpoint;
  }

  async pinReceipt(receipt: Receipt): Promise<{ cid: string; url: string }> {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const formData = new FormData();
    formData.append("file", blob, `${receipt.nonce}.json`);

    const res = await fetch(`${this.endpoint}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });

    if (!res.ok) throw new Error(`IPFS pin failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { cid: string };
    return { cid: data.cid, url: `https://w3s.link/ipfs/${data.cid}` };
  }

  async fetchReceipt(cid: string): Promise<Receipt | null> {
    const res = await fetch(`https://w3s.link/ipfs/${cid}`, { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as Receipt;
  }
}

export class PinataIpfsClient implements IpfsClient {
  private jwt: string;

  constructor(jwt: string) {
    this.jwt = jwt;
  }

  async pinReceipt(receipt: Receipt): Promise<{ cid: string; url: string }> {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const formData = new FormData();
    formData.append("file", blob, `${receipt.nonce}.json`);
    formData.append(
      "pinataMetadata",
      JSON.stringify({ name: `amanah-receipt-${receipt.nonce}`, keyvalues: { eventType: receipt.eventType } })
    );

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.jwt}` },
      body: formData,
    });

    if (!res.ok) throw new Error(`Pinata pin failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { IpfsHash: string };
    return { cid: data.IpfsHash, url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}` };
  }

  async fetchReceipt(cid: string): Promise<Receipt | null> {
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as Receipt;
  }
}

export class MockIpfsClient implements IpfsClient {
  private store = new Map<string, Receipt>();

  async pinReceipt(receipt: Receipt): Promise<{ cid: string; url: string }> {
    const cid = `mock-${receipt.nonce}`;
    this.store.set(cid, receipt);
    return { cid, url: `https://mock.ipfs/${cid}` };
  }

  async fetchReceipt(cid: string): Promise<Receipt | null> {
    return this.store.get(cid) ?? null;
  }
}

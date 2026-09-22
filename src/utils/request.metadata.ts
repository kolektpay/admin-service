// src/utils/request-metadata.util.ts
import { Request } from "express";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";

export interface RequestMetadata {
  ip?: string;
  location?: string;
  device?: string;
  browser?: string;
  os?: string;
}

export const extractRequestMetadata = (
  req: Request
): RequestMetadata => {
  // 1️⃣ User agent
  const userAgent = req.headers["user-agent"];

  const parser = new UAParser(userAgent);
  const device = parser.getDevice().type || "Desktop";
  const browser = parser.getBrowser().name;
  const os = parser.getOS().name;

  // 2️⃣ IP address
  const ip =
    (req.headers["x-forwarded-for"] as string) ||
    req.socket.remoteAddress;

  // 3️⃣ Location
  let location: string | undefined;
  if (ip) {
    const geo = geoip.lookup(ip);
    if (geo) {
      location = `${geo.city}, ${geo.country}`;
    }
  }

  return {
    ip,
    location,
    device,
    browser,
    os,
  };
};

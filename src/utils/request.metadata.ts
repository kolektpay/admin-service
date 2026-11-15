// src/utils/request-metadata.util.ts
import { Request } from "express";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

import { RequestMetadata } from "../interfaces/requestMetadata.interface";
import { clientIp } from "./auditContext";

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
  // From req.ip, which only trusts X-Forwarded-For for the configured proxy
  // hops (TRUST_PROXY), so clients cannot fake it
  const ip = clientIp(req);

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

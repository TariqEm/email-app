import { BLOCKED_ISPS } from './blocked-isps';
import { BLOCKED_IPS, BLOCKED_IP_RANGES } from './blocked-ips';

export interface FraudCheckResult {
  isFraud: boolean;
  reason?: string;
  blockType?: 'ip' | 'isp' | 'organization' | 'datacenter';
}

export class FraudDetector {
  /**
   * Check if IP or ISP is blocked
   */
  static check(params: {
    ip: string;
    isp?: string | null;
    organization?: string | null;
  }): FraudCheckResult {
    const { ip, isp, organization } = params;

    // Check exact IP match
    if (BLOCKED_IPS.has(ip)) {
      console.log(`🚫 Fraud detected: Blocked IP ${ip}`);
      return {
        isFraud: true,
        reason: `IP ${ip} is blacklisted`,
        blockType: 'ip'
      };
    }

    // Check IP ranges (CIDR)
    for (const range of BLOCKED_IP_RANGES) {
      if (this.isIPInRange(ip, range)) {
        console.log(`🚫 Fraud detected: IP ${ip} in blocked range ${range}`);
        return {
          isFraud: true,
          reason: `IP ${ip} is in blocked range ${range}`,
          blockType: 'ip'
        };
      }
    }

    // Check ISP
    if (isp) {
      const ispLower = isp.toLowerCase();
      for (const blockedIsp of BLOCKED_ISPS) {
        if (ispLower.includes(blockedIsp)) {
          console.log(`🚫 Fraud detected: Blocked ISP "${isp}"`);
          return {
            isFraud: true,
            reason: `ISP "${isp}" is blocked`,
            blockType: 'isp'
          };
        }
      }
    }

    // Check Organization
    if (organization) {
      const orgLower = organization.toLowerCase();
      for (const blockedIsp of BLOCKED_ISPS) {
        if (orgLower.includes(blockedIsp)) {
          console.log(`🚫 Fraud detected: Blocked organization "${organization}"`);
          return {
            isFraud: true,
            reason: `Organization "${organization}" is blocked`,
            blockType: 'organization'
          };
        }
      }

      // Check for datacenter/hosting keywords
      const datacenterKeywords = [
        'datacenter', 'data center', 'hosting', 'cloud', 
        'vps', 'dedicated', 'colocation', 'colo'
      ];
      
      for (const keyword of datacenterKeywords) {
        if (orgLower.includes(keyword)) {
          console.log(`🚫 Fraud detected: Datacenter organization "${organization}"`);
          return {
            isFraud: true,
            reason: `Organization "${organization}" appears to be a datacenter`,
            blockType: 'datacenter'
          };
        }
      }
    }

    return { isFraud: false };
  }

  /**
   * Check if IP is in CIDR range
   */
  private static isIPInRange(ip: string, cidr: string): boolean {
    try {
      const [range, bits] = cidr.split('/');
      const mask = ~(2 ** (32 - parseInt(bits)) - 1);
      
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);
      
      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }

  /**
   * Convert IP string to number
   */
  private static ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => {
      return (acc << 8) + parseInt(octet);
    }, 0) >>> 0;
  }

  /**
   * Add IP to blocklist dynamically
   */
  static addBlockedIP(ip: string): void {
    BLOCKED_IPS.add(ip);
    console.log(`➕ Added ${ip} to blocklist`);
  }

  /**
   * Remove IP from blocklist
   */
  static removeBlockedIP(ip: string): boolean {
    const removed = BLOCKED_IPS.delete(ip);
    if (removed) {
      console.log(`➖ Removed ${ip} from blocklist`);
    }
    return removed;
  }

  /**
   * Check if IP is in blocklist
   */
  static isIPBlocked(ip: string): boolean {
    return BLOCKED_IPS.has(ip);
  }

  /**
   * Get blocklist stats
   */
  static getStats() {
    return {
      blockedIPs: BLOCKED_IPS.size,
      blockedIPRanges: BLOCKED_IP_RANGES.length,
      blockedISPs: BLOCKED_ISPS.length,
    };
  }
}

import { Manufacturer } from '../../types/manufacturer';
import { WarrantyInfo } from '../../types/warranty';
import axios from 'axios';
import { logger } from '@/lib/logger';

// List of Service Level Codes not related to hardware warranties
const SLC_BLACKLIST = ['D', 'DL', 'PJ', 'PR'];

interface DellTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface DellEntitlement {
  startDate: string;
  endDate: string;
  serviceLevelCode: string;
  serviceLevelDescription: string;
}

interface DellDeviceInfo {
  id: number;
  serviceTag: string;
  orderBuid: number;
  shipDate: string;
  productCode: string;
  localChannel: string;
  productId: string;
  productLineDescription: string;
  productFamily: string;
  systemDescription: string;
  productLobDescription: string;
  countryCode: string;
  duplicated: boolean;
  invalid: boolean;
  entitlements: DellEntitlement[];
}

// Cache token and its expiration time
let dellToken: string | null = null;
let tokenExpiration: Date | null = null;

async function getDellAuthToken(clientId: string, clientSecret: string): Promise<string> {
  // Check if we have a valid cached token
  if (dellToken && tokenExpiration && tokenExpiration > new Date()) {
    return dellToken;
  }

  // Get new token
  const authString = `${clientId}:${clientSecret}`;
  const encodedAuth = Buffer.from(authString).toString('base64');
  
  try {
    const response = await axios.post<DellTokenResponse>(
      'https://apigtwb2c.us.dell.com/auth/oauth/v2/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${encodedAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    // Cache the token and set expiration (55 minutes from now to be safe)
    dellToken = response.data.access_token;
    tokenExpiration = new Date(Date.now() + 55 * 60 * 1000);
    
    return dellToken;
  } catch (error) {
    logger.error(`Error getting Dell auth token: ${error}`, 'dell-api', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error('Failed to authenticate with Dell API');
  }
}

// Warning: the Dell API integration is still being tested and may not work as expected
async function fetchDellWarrantyData(
  serialNumber: string,
  clientId: string,
  clientSecret: string
): Promise<WarrantyInfo> {
  // Get authentication token
  const token = await getDellAuthToken(clientId, clientSecret);

  // Call Dell warranty API
  const response = await axios.get<DellDeviceInfo[]>(
    'https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        servicetags: serialNumber
      }
    }
  );

  // The API returns an array of devices
  if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
    logger.error('Invalid response format from Dell API', 'dell-api', {
      serialNumber,
      responseData: response.data
    });
    throw new Error('Invalid response format from Dell API - expected array');
  }

  // Get the device info
  const deviceInfo = response.data[0];

  // Validate device found
  if (deviceInfo.invalid) {
    throw new Error(`Invalid service tag: ${serialNumber}`);
  }

  // Check if the device has entitlements
  if (!deviceInfo.entitlements || deviceInfo.entitlements.length === 0) {
    throw new Error(`No warranty entitlements found for ${serialNumber}`);
  }

  // Filter out non-hardware warranty entitlements
  const validEntitlements = deviceInfo.entitlements.filter(
    e => !SLC_BLACKLIST.includes(e.serviceLevelCode)
  );

  if (validEntitlements.length === 0) {
    throw new Error(`No valid warranty entitlements found for ${serialNumber}`);
  }

  // Sort dates to find start and end dates
  const startDates = validEntitlements.map(e => new Date(e.startDate)).sort((a, b) => a.getTime() - b.getTime());
  const endDates = validEntitlements.map(e => new Date(e.endDate)).sort((a, b) => b.getTime() - a.getTime());

  const startDate = startDates[0].toISOString().split('T')[0];
  const endDate = endDates[0].toISOString().split('T')[0];

  // Get unique service descriptions
  const coverageDetails = Array.from(new Set(
    validEntitlements.map(e => e.serviceLevelDescription)
  ));

  // Use product description if available
  const productDescription = deviceInfo.systemDescription ||
    deviceInfo.productLineDescription ||
    'Dell Product';

  return {
    serialNumber,
    manufacturer: Manufacturer.DELL,
    startDate,
    endDate,
    productDescription,
    coverageDetails
  };
}

// Mock Dell data for demos
async function getMockDellWarrantyInfo(serialNumber: string): Promise<WarrantyInfo> {
  try {
    logger.info(`Looking up Dell warranty for ${serialNumber} (mock implementation)`, 'dell-api', {
      serialNumber,
      mode: 'mock'
    });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate a random end date between 0-24 months from now
    const today = new Date();
    const startDate = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
    const randomMonths = Math.floor(Math.random() * 48) - 24; // Random months between -24 and +24
    const endDate = new Date(today.getFullYear(), today.getMonth() + randomMonths, today.getDate());
    
    // Get the formatted dates
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    return {
      serialNumber,
      manufacturer: Manufacturer.DELL,
      startDate: startDateStr,
      endDate: endDateStr,
      productDescription: 'Dell Latitude 5420 (mock data)',
      coverageDetails: [
        'Hardware Support',
        'Next Business Day Onsite Service'
      ]
    };
  } catch (error) {
    logger.error(`Error fetching Dell warranty: ${error}`, 'dell-api', {
      serialNumber,
      mode: 'mock',
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      serialNumber,
      manufacturer: Manufacturer.DELL,
      startDate: '',
      endDate: '',
    };
  }
}

export async function getDellWarrantyInfo(
  serialNumber: string,
  clientId?: string,
  clientSecret?: string
): Promise<WarrantyInfo> {
  // Check if both clientId and clientSecret are provided
  if (clientId && clientSecret) {
    const warranty = await fetchDellWarrantyData(serialNumber, clientId, clientSecret);
    logger.info(`Found Dell warranty for ${serialNumber}: ${warranty.startDate} to ${warranty.endDate}`, 'dell-api', {
      serialNumber,
      startDate: warranty.startDate,
      endDate: warranty.endDate,
      mode: 'api'
    });
    return warranty;
  } else {
    logger.info('clientId / clientSecret is not provided, falling back to mock implementation', 'dell-api', {
      serialNumber,
      mode: 'mock-fallback'
    });
  }

  return getMockDellWarrantyInfo(serialNumber);
} 
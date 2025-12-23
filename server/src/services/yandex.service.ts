import axios, { AxiosInstance } from 'axios';

export interface YandexDirectConfig {
  token: string;
  clientLogin: string;
}

export class YandexDirectService {
  private client: AxiosInstance;
  private config: YandexDirectConfig;

  constructor() {
    this.config = {
      token: process.env.YANDEX_DIRECT_TOKEN || '',
      clientLogin: process.env.YANDEX_CLIENT_LOGIN || ''
    };

    this.client = axios.create({
      baseURL: 'https://api.direct.yandex.com/json/v5',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Client-Login': this.config.clientLogin,
        'Accept-Language': 'ru',
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }

  /**
   * Создание рекламной кампании
   */
  async createCampaign(campaignData: any) {
    try {
      const response = await this.client.post('/campaigns', {
        method: 'add',
        params: {
          Campaigns: [campaignData]
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Yandex Direct API Error:', error.response?.data);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  }

  /**
   * Получение списка кампаний
   */
  async getCampaigns() {
    try {
      const response = await this.client.post('/campaigns', {
        method: 'get',
        params: {
          SelectionCriteria: {},
          FieldNames: ['Id', 'Name', 'State', 'Status', 'Type']
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Yandex Direct API Error:', error.response?.data);
      throw new Error(`Failed to get campaigns: ${error.message}`);
    }
  }

  /**
   * Создание группы объявлений
   */
  async createAdGroup(adGroupData: any) {
    try {
      const response = await this.client.post('/adgroups', {
        method: 'add',
        params: {
          AdGroups: [adGroupData]
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Yandex Direct API Error:', error.response?.data);
      throw new Error(`Failed to create ad group: ${error.message}`);
    }
  }

  /**
   * Создание объявлений
   */
  async createAds(adsData: any[]) {
    try {
      const response = await this.client.post('/ads', {
        method: 'add',
        params: {
          Ads: adsData
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Yandex Direct API Error:', error.response?.data);
      throw new Error(`Failed to create ads: ${error.message}`);
    }
  }

  /**
   * Добавление ключевых слов
   */
  async addKeywords(keywords: any[]) {
    try {
      const response = await this.client.post('/keywords', {
        method: 'add',
        params: {
          Keywords: keywords
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Yandex Direct API Error:', error.response?.data);
      throw new Error(`Failed to add keywords: ${error.message}`);
    }
  }

  /**
   * Получение рекомендаций по ставкам
   */
  async getBidRecommendations(keywordIds: number[]) {
    try {
      const response = await this.client.post('/keywords', {
        method: 'get',
        params: {
          SelectionCriteria: {
            Ids: keywordIds
          },
          FieldNames: ['Id', 'Keyword', 'Bid'],
          TextAdGroupFeedParams: {
            FieldNames: ['Bid']
          }
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Yandex Direct API Error:', error.response?.data);
      throw new Error(`Failed to get bid recommendations: ${error.message}`);
    }
  }

  /**
   * Получение статистики кампании
   */
  async getCampaignStats(campaignId: number, dateFrom: string, dateTo: string) {
    try {
      const reportData = {
        params: {
          SelectionCriteria: {
            Filter: [
              {
                Field: 'CampaignId',
                Operator: 'EQUALS',
                Values: [campaignId.toString()]
              }
            ],
            DateFrom: dateFrom,
            DateTo: dateTo
          },
          FieldNames: [
            'Date',
            'CampaignName',
            'Impressions',
            'Clicks',
            'Cost',
            'Conversions'
          ],
          ReportName: 'Campaign Statistics',
          ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
          DateRangeType: 'CUSTOM_DATE',
          Format: 'TSV',
          IncludeVAT: 'YES',
          IncludeDiscount: 'YES'
        }
      };

      const response = await axios.post(
        'https://api.direct.yandex.com/json/v5/reports',
        reportData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Client-Login': this.config.clientLogin,
            'Accept-Language': 'ru',
            'Content-Type': 'application/json; charset=utf-8',
            'returnMoneyInMicros': 'false',
            'skipReportHeader': 'true',
            'skipReportSummary': 'true'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Yandex Direct API Error:', error.response?.data);
      throw new Error(`Failed to get campaign stats: ${error.message}`);
    }
  }
}

export const yandexDirectService = new YandexDirectService();

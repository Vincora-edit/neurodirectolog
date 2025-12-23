import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export interface CampaignExportData {
  campaignName: string;
  adGroups: Array<{
    name: string;
    keywords: string[];
    ads: Array<{
      headline: string;
      text: string;
      displayUrl?: string;
    }>;
    minusWords?: string[];
  }>;
}

export class ExcelService {
  /**
   * Экспорт кампании в Excel формат для Яндекс.Директ
   */
  async exportCampaignToExcel(data: CampaignExportData): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Campaign');

    // Заголовки
    worksheet.columns = [
      { header: 'Название кампании', key: 'campaignName', width: 30 },
      { header: 'Название группы', key: 'groupName', width: 30 },
      { header: 'Ключевая фраза', key: 'keyword', width: 40 },
      { header: 'Заголовок', key: 'headline', width: 40 },
      { header: 'Текст объявления', key: 'text', width: 60 },
      { header: 'Отображаемая ссылка', key: 'displayUrl', width: 40 },
      { header: 'Минус-слова', key: 'minusWords', width: 40 }
    ];

    // Стилизация заголовков
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Заполнение данных
    data.adGroups.forEach(group => {
      group.keywords.forEach(keyword => {
        group.ads.forEach(ad => {
          worksheet.addRow({
            campaignName: data.campaignName,
            groupName: group.name,
            keyword: keyword,
            headline: ad.headline,
            text: ad.text,
            displayUrl: ad.displayUrl || '',
            minusWords: group.minusWords?.join(', ') || ''
          });
        });
      });
    });

    // Сохранение файла
    const fileName = `campaign_${Date.now()}.xlsx`;
    const filePath = path.join(process.cwd(), 'exports', fileName);

    // Создание директории, если не существует
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * Экспорт кампании в CSV формат
   */
  async exportCampaignToCSV(data: CampaignExportData): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Campaign');

    worksheet.columns = [
      { header: 'Название кампании', key: 'campaignName' },
      { header: 'Название группы', key: 'groupName' },
      { header: 'Ключевая фраза', key: 'keyword' },
      { header: 'Заголовок', key: 'headline' },
      { header: 'Текст объявления', key: 'text' },
      { header: 'Отображаемая ссылка', key: 'displayUrl' },
      { header: 'Минус-слова', key: 'minusWords' }
    ];

    data.adGroups.forEach(group => {
      group.keywords.forEach(keyword => {
        group.ads.forEach(ad => {
          worksheet.addRow({
            campaignName: data.campaignName,
            groupName: group.name,
            keyword: keyword,
            headline: ad.headline,
            text: ad.text,
            displayUrl: ad.displayUrl || '',
            minusWords: group.minusWords?.join(', ') || ''
          });
        });
      });
    });

    const fileName = `campaign_${Date.now()}.csv`;
    const filePath = path.join(process.cwd(), 'exports', fileName);

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    await workbook.csv.writeFile(filePath);
    return filePath;
  }

  /**
   * Экспорт семантического ядра
   */
  async exportSemantics(keywords: string[], fileName?: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Keywords');

    worksheet.columns = [
      { header: 'Ключевая фраза', key: 'keyword', width: 50 },
      { header: 'Категория', key: 'category', width: 30 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    keywords.forEach(keyword => {
      worksheet.addRow({
        keyword: keyword,
        category: '' // Можно добавить категоризацию
      });
    });

    const exportFileName = fileName || `semantics_${Date.now()}.xlsx`;
    const filePath = path.join(process.cwd(), 'exports', exportFileName);

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * Экспорт минус-слов
   */
  async exportMinusWords(minusWords: string[]): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Minus Words');

    worksheet.columns = [
      { header: 'Минус-слово', key: 'word', width: 40 }
    ];

    worksheet.getRow(1).font = { bold: true };

    minusWords.forEach(word => {
      worksheet.addRow({ word });
    });

    const fileName = `minus_words_${Date.now()}.xlsx`;
    const filePath = path.join(process.cwd(), 'exports', fileName);

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }
}

export const excelService = new ExcelService();

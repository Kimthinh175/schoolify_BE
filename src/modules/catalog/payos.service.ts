import { Injectable, Logger } from '@nestjs/common';
import { PayOS } from '@payos/node';

export interface PayOSCreateLinkParams {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl: string;
  returnUrl: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  buyerName?: string;
  buyerEmail?: string;
}

export interface PayOSPaymentResult {
  isLivePayOS: boolean;
  orderCode: number;
  amount: number;
  description: string;
  accountNumber: string;
  accountName: string;
  bin: string;
  qrCode: string;
  rawQrCode?: string | null;
  checkoutUrl?: string | null;
  paymentLinkId?: string | null;
  status: string;
  error?: string | null;
}

@Injectable()
export class PayOSService {
  private readonly logger = new Logger(PayOSService.name);
  private payOS: PayOS | null = null;
  private isConfigured = false;

  constructor() {
    this.initClient();
  }

  public initClient() {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (clientId && apiKey && checksumKey) {
      try {
        this.payOS = new PayOS({
          clientId,
          apiKey,
          checksumKey,
        });
        this.isConfigured = true;
        this.logger.log('🚀 PayOS SDK v2 Client đã được khởi tạo thành công');
      } catch (err: any) {
        this.logger.warn(`⚠️ Lỗi cấu hình PayOS Client: ${err?.message}`);
        this.payOS = null;
        this.isConfigured = false;
      }
    } else {
      this.logger.warn('⚠️ Chưa đủ biến môi trường PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY');
      this.isConfigured = false;
    }
  }

  public isReady(): boolean {
    return this.isConfigured && this.payOS !== null;
  }

  /**
   * Tạo Payment Link PayOS (VietQR Chuẩn Tự Động)
   */
  async createPaymentLink(params: PayOSCreateLinkParams): Promise<PayOSPaymentResult> {
    const cleanDesc = (params.description || `SCH ${params.orderCode}`)
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .slice(0, 25);

    if (this.payOS) {
      try {
        const linkRes = await this.payOS.paymentRequests.create({
          orderCode: params.orderCode,
          amount: Math.round(params.amount),
          description: cleanDesc,
          cancelUrl: params.cancelUrl,
          returnUrl: params.returnUrl,
          items: params.items?.map((item) => ({
            name: item.name.slice(0, 50),
            quantity: item.quantity,
            price: Math.round(item.price),
          })),
          buyerName: params.buyerName,
          buyerEmail: params.buyerEmail,
        });

        this.logger.log(`✅ Đã tạo PayOS Payment Link cho orderCode=${params.orderCode}`);
        const qrImageUrl = linkRes.qrCode.startsWith('http')
          ? linkRes.qrCode
          : `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(linkRes.qrCode)}`;

        return {
          isLivePayOS: true,
          orderCode: linkRes.orderCode,
          amount: linkRes.amount,
          description: linkRes.description,
          accountNumber: linkRes.accountNumber,
          accountName: linkRes.accountName,
          bin: linkRes.bin,
          qrCode: qrImageUrl,
          rawQrCode: linkRes.qrCode,
          checkoutUrl: linkRes.checkoutUrl,
          paymentLinkId: linkRes.paymentLinkId,
          status: linkRes.status,
        };
      } catch (err: any) {
        this.logger.warn(
          `⚠️ Không thể tạo link trực tiếp từ PayOS API (${err?.message}). Chuyển sang VietQR fallback.`
        );
        return this.createFallbackResult(params, cleanDesc, err?.message);
      }
    }

    return this.createFallbackResult(params, cleanDesc, 'PayOS client chưa được cấu hình');
  }

  /**
   * Lấy trạng thái thanh toán từ PayOS Cloud
   */
  async getPaymentStatus(orderCode: number): Promise<{
    status: string;
    amountPaid?: number;
    transactions?: any[];
    error?: string;
  }> {
    if (!this.payOS) {
      return { status: 'PENDING', error: 'PayOS client chưa cấu hình' };
    }

    try {
      const paymentInfo = await this.payOS.paymentRequests.get(orderCode);
      return {
        status: paymentInfo.status,
        amountPaid: paymentInfo.amountPaid,
        transactions: paymentInfo.transactions,
      };
    } catch (err: any) {
      this.logger.warn(`Lỗi truy vấn PayOS status orderCode=${orderCode}: ${err?.message}`);
      return { status: 'PENDING', error: err?.message };
    }
  }

  /**
   * Xác thực chữ ký webhook từ PayOS
   */
  async verifyWebhook(webhookBody: any): Promise<any> {
    if (!this.payOS) {
      throw new Error('PayOS client chưa được cấu hình');
    }
    return this.payOS.webhooks.verify(webhookBody);
  }

  /**
   * Đăng ký Webhook URL với PayOS
   */
  async confirmWebhook(webhookUrl: string): Promise<any> {
    if (!this.payOS) {
      throw new Error('PayOS client chưa được cấu hình');
    }
    return this.payOS.webhooks.confirm(webhookUrl);
  }

  /**
   * Fallback VietQR thông minh khi PayOS chờ nạp đủ Checksum Key 64-hex
   */
  private createFallbackResult(
    params: PayOSCreateLinkParams,
    cleanDesc: string,
    errorReason?: string
  ): PayOSPaymentResult {
    const bankId = 'MB';
    const accountNo = '0903888899';
    const accountName = 'CONG TY CO PHAN SCHOOLIFY';
    // VietQR quick chart URL
    const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${params.amount}&addInfo=${encodeURIComponent(
      cleanDesc
    )}&accountName=${encodeURIComponent(accountName)}`;

    return {
      isLivePayOS: false,
      orderCode: params.orderCode,
      amount: params.amount,
      description: cleanDesc,
      accountNumber: accountNo,
      accountName,
      bin: '970422',
      qrCode: vietQrUrl,
      checkoutUrl: null,
      paymentLinkId: null,
      status: 'PENDING',
      error: errorReason,
    };
  }
}

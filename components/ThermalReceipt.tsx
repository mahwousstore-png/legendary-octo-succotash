// src/components/ThermalReceipt.tsx
import React from 'react';
import { Order } from '../types/order';
import './ThermalReceipt.css'; // استيراد ملف CSS

interface ThermalReceiptProps {
  order: Order | null;
}

const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ order }) => {
  const formatSAR = (amount: number | string | undefined) => {
    if (amount === undefined || amount === null || amount === '') return '0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  if (!order) return null;

  return (
    <div className="thermal-receipt">
      <img
        src="https://ik.imagekit.io/hkp0zcyja/%D9%85%D9%86%D9%88%D8%B9/%D8%B4%D8%B9%D8%A7%D8%B1-%D9%85%D9%87%D9%88%D9%88%D8%B3.webp"
        alt="شعار مهووس"
        className="receipt-logo"
      />
      <h2 className="receipt-title">مهووس</h2>
      <div className="receipt-divider"></div>
      <div className="receipt-header">
        <p>رقم الطلب: #{order.order_number}</p>
        <p>تاريخ الطلب: {new Date(order.order_date).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}</p>
        <p>اسم العميل: {order.customer_name || 'غير مسجل'}</p>
        <p>رقم الهاتف: {order.phone_number || 'غير مسجل'}</p>
      </div>
      <div className="receipt-divider"></div>
      <div className="receipt-products">
        <table className="products-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.products?.map((product, index) => (
              <tr key={index}>
                <td>{product.name}</td>
                <td>{product.quantity}</td>
                <td>{formatSAR(product.unit_price)} ر.س</td>
                <td>{formatSAR(product.quantity * (product.unit_price || 0))} ر.س</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="receipt-divider"></div>
      <div className="receipt-totals">
        <p>الفرعي: {formatSAR(order.subtotal_before_tax)} ر.س</p>
        <p>الضريبة: {formatSAR(order.tax_amount)} ر.س</p>
        <p>الشحن: {formatSAR(order.shipping_cost)} ر.س</p>
        <p className="total-line">الإجمالي: {formatSAR(order.total_price)} ر.س</p>
      </div>
      <div className="receipt-divider"></div>
      <p className="receipt-thanks">شكراً لتسوقك مع مهووس!</p>
    </div>
  );
};

export default ThermalReceipt;
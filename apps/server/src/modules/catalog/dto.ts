export const productDto = (p: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  ...p,
  stock: p.stockMilli / 1000,
  alertThreshold: p.alertMilli / 1000,
  outOfStock: p.stockMilli <= 0,
  lowStock: p.stockMilli > 0 && p.alertMilli > 0 && p.stockMilli <= p.alertMilli,
});

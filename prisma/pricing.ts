/**
 * The two numbers that convert a publisher's price book into a shelf price.
 *
 * Both live here rather than in each publisher's module, because an error in
 * either is an error on every price in the shop, and two copies of a number
 * that must agree is how they stop agreeing.
 */

/** GST on a software licence in India. Matches `Product.gstRatePercent`. */
export const GST_PERCENT = 18;

/**
 * Rupees to the dollar for the export price.
 *
 * The India price books carry no dollar column, so the export price is
 * converted from the rupee figure — before GST, since an export is zero-rated
 * and converting the tax-inclusive number would export the GST too.
 *
 * That makes it a derived number, not a publisher's own USD list. Microsoft
 * and Adobe both price India as its own market, so per-SKU margin varies a few
 * percent either way from what the same licence costs in dollars elsewhere. It
 * is a reasonable starting point and not a substitute for the USD price book.
 * Set it to the rate you actually want to sell at, not the mid-market rate on
 * the day.
 */
export const INR_PER_USD = 88;

/** What an Indian buyer pays, tax included, in whole rupees. */
export function inrShelfPrice(listExGstMinor: number): number {
  return Math.round((listExGstMinor / 100) * (1 + GST_PERCENT / 100));
}

/**
 * What an export buyer pays, in whole dollars.
 *
 * Converted from the *tax-inclusive* rupee figure, by instruction: the export
 * price is set at the same level as the domestic one rather than 18% below it.
 *
 * That is a pricing decision, and it is not a tax. An Indian supply of a
 * software licence to a customer outside India is a zero-rated export, so no
 * GST is chargeable on it and none is collected here — the export invoice shows
 * no tax line and says the supply is zero-rated, which is what the law
 * requires and what `totalsFor` computes. The 18% is simply part of the price
 * abroad. Calling it GST on an invoice would be a false tax statement, so
 * nothing in this application does.
 *
 * Never less than a dollar, because a rounded-down zero would be a free
 * licence.
 */
export function usdShelfPrice(listExGstMinor: number): number {
  const inclusive = (listExGstMinor / 100) * (1 + GST_PERCENT / 100);
  return Math.max(1, Math.round(inclusive / INR_PER_USD));
}

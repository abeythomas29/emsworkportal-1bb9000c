export const COURIERS: { name: string; trackUrl: (id: string) => string }[] = [
  { name: 'Delhivery', trackUrl: (id) => `https://www.delhivery.com/track-v2/package/${encodeURIComponent(id)}` },
  { name: 'Bluedart', trackUrl: (id) => `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodeURIComponent(id)}` },
  { name: 'DTDC', trackUrl: (id) => `https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${encodeURIComponent(id)}&TrkType=cnno` },
  { name: 'Ekart', trackUrl: (id) => `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(id)}` },
  { name: 'Ecom Express', trackUrl: (id) => `https://ecomexpress.in/tracking/?awb_field=${encodeURIComponent(id)}` },
  { name: 'XpressBees', trackUrl: (id) => `https://www.xpressbees.com/shipment/tracking?awbNo=${encodeURIComponent(id)}` },
  { name: 'Shadowfax', trackUrl: (id) => `https://tracker.shadowfax.in/#/?trackingId=${encodeURIComponent(id)}` },
  { name: 'India Post', trackUrl: (id) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?id=${encodeURIComponent(id)}` },
  { name: 'DHL', trackUrl: (id) => `https://www.dhl.com/in-en/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(id)}` },
  { name: 'FedEx', trackUrl: (id) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(id)}` },
  { name: 'ST Courier', trackUrl: (id) => `https://stcourier.com/track/shipment?ConsignmentNo=${encodeURIComponent(id)}` },
  { name: 'Professional', trackUrl: (id) => `https://www.tpcindia.com/Tracking2.aspx?id=${encodeURIComponent(id)}` },
  { name: 'Trackon', trackUrl: (id) => `https://trackon.in/Tracking/MultiTracking?TrackingNo=${encodeURIComponent(id)}` },
  { name: 'Gati', trackUrl: (id) => `https://www.gati.com/single-shipment-tracking/?dktNo=${encodeURIComponent(id)}` },
  { name: 'Maruti', trackUrl: (id) => `https://www.maruticourier.com/tracking.aspx?docno=${encodeURIComponent(id)}` },
  { name: 'Other', trackUrl: (id) => `https://www.google.com/search?q=${encodeURIComponent(id + ' tracking')}` },
];

export function getCourierTrackingUrl(courier: string, trackingId: string): string {
  const found = COURIERS.find((c) => c.name.toLowerCase() === (courier || '').toLowerCase());
  return (found || COURIERS[COURIERS.length - 1]).trackUrl(trackingId);
}

export const PARCEL_STATUSES = ['pending', 'in_transit', 'delivered', 'returned'] as const;
export type ParcelStatus = typeof PARCEL_STATUSES[number];

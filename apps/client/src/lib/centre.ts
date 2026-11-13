/**
 * The centre's own details. One place, so the address on an invoice, the
 * privacy notice and the contact page can never disagree.
 *
 * Source: RFQ NWBRT/2026/10 and the business plan.
 */
export const CENTRE = {
  name: "Skolopals Tutoring Centre",
  tagline: "Learning Today. Succeeding Tomorrow.",
  addressLine: "10 Plumbago Street, Damonsville",
  town: "Brits",
  province: "North West",
  phone: "067 244 7296",
  phoneLink: "tel:+27672447296",
  whatsappLink: "https://wa.me/27672447296",
  informationOfficer: "Winnie Thobela",
} as const;

export const CENTRE_ADDRESS = `${CENTRE.addressLine}, ${CENTRE.town}, ${CENTRE.province}`;

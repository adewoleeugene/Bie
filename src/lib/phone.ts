const COUNTRY_DIAL_CODES: Record<string, string> = {
    GH: "233",
    SL: "232",
    NG: "234",
    US: "1",
    GB: "44",
};

export const WHATSAPP_COUNTRIES = [
    { code: "GH", name: "Ghana", dialCode: "+233" },
    { code: "SL", name: "Sierra Leone", dialCode: "+232" },
    { code: "NG", name: "Nigeria", dialCode: "+234" },
    { code: "US", name: "United States", dialCode: "+1" },
    { code: "GB", name: "United Kingdom", dialCode: "+44" },
] as const;

export function normalizePhoneNumber(country: string, value: string): string {
    const dialCode = COUNTRY_DIAL_CODES[country];
    if (!dialCode) {
        throw new Error("Choose a supported country");
    }

    const digits = value.replace(/[^\d+]/g, "");
    const numeric = digits.startsWith("+")
        ? digits.slice(1)
        : digits.replace(/^0+/, "");

    const withCountryCode = numeric.startsWith(dialCode)
        ? numeric
        : `${dialCode}${numeric}`;

    if (!/^\d{8,15}$/.test(withCountryCode)) {
        throw new Error("Enter a valid WhatsApp number");
    }

    return `+${withCountryCode}`;
}

export function normalizeWhapiSender(value: string): string | null {
    const phone = value.split("@")[0]?.replace(/\D/g, "");
    if (!phone || phone.length < 8 || phone.length > 15) return null;
    return `+${phone}`;
}

export function toWhapiRecipient(phone: string): string {
    return phone.replace(/\D/g, "");
}

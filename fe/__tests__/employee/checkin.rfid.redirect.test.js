import { redirect } from "next/navigation";

import RfidRedirect from "@/app/employee/checkin/rfid/page";
import RfidCatchAllRedirect from "@/app/employee/checkin/rfid/[...slug]/page";

jest.mock("next/navigation", () => ({
    redirect: jest.fn(),
}));

describe("legacy RFID route redirects", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Validates: Requirements 7.3
    it("redirects /employee/checkin/rfid to /employee/checkin", () => {
        RfidRedirect();

        expect(redirect).toHaveBeenCalledTimes(1);
        expect(redirect).toHaveBeenCalledWith("/employee/checkin");
    });

    // Validates: Requirements 7.4
    it("redirects any /employee/checkin/rfid/* sub-path to /employee/checkin", () => {
        RfidCatchAllRedirect();

        expect(redirect).toHaveBeenCalledTimes(1);
        expect(redirect).toHaveBeenCalledWith("/employee/checkin");
    });
});

import { checkInByRfid } from "@/app/api/employee.client";

jest.mock("@/app/api/client.config", () => ({
    post: jest.fn(),
}));

import api from "@/app/api/client.config";

describe("employee client", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("calls rfid entry endpoint with payload and returns response data", async () => {
        const sessionData = {
            card_uid: "RFID-12345",
            vehicle_type: "motorbike",
        };
        const responseData = {
            success: true,
            data: {
                session_id: 99,
            },
        };

        api.post.mockResolvedValue({ data: responseData });

        const result = await checkInByRfid(sessionData);

        expect(api.post).toHaveBeenCalledWith("/employee/parking/entry/rfid", sessionData);
        expect(result).toEqual(responseData);
    });

    it("rethrows axios errors for caller-level mapping", async () => {
        const sessionData = {
            card_uid: "RFID-EXISTS",
            vehicle_type: "car",
        };
        const axiosError = {
            response: {
                status: 409,
                data: {
                    message: "RFID card already in active session",
                },
            },
        };

        api.post.mockRejectedValue(axiosError);

        await expect(checkInByRfid(sessionData)).rejects.toBe(axiosError);
        expect(api.post).toHaveBeenCalledWith("/employee/parking/entry/rfid", sessionData);
    });
});

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";

const Footer = () => {
    const pathname = usePathname();

    // Don't render footer on auth pages
    if (pathname?.startsWith("/login") || pathname?.startsWith("/admin") || pathname?.startsWith("/employee")) {
        return null;
    }

    return (
        <footer className="bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <h3 className="text-lg font-semibold mb-4">About Us</h3>
                        <p className="text-gray-600">
                            Modern parking lot management system for efficient vehicle parking and space optimization.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/how-it-works" className="text-gray-600 hover:text-blue-600">
                                    How It Works
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="text-gray-600 hover:text-blue-600">
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link href="/faq" className="text-gray-600 hover:text-blue-600">
                                    FAQ
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-gray-600 hover:text-blue-600">
                                    Contact
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-4">Services</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/monthly-parking" className="text-gray-600 hover:text-blue-600">
                                    Monthly Parking
                                </Link>
                            </li>
                            <li>
                                <Link href="/hourly-parking" className="text-gray-600 hover:text-blue-600">
                                    Hourly Parking
                                </Link>
                            </li>
                            <li>
                                <Link href="/valet-service" className="text-gray-600 hover:text-blue-600">
                                    Valet Service
                                </Link>
                            </li>
                            <li>
                                <Link href="/ev-charging" className="text-gray-600 hover:text-blue-600">
                                    EV Charging
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-4">Connect</h3>
                        <div className="flex space-x-4">
                            <a href="#" className="text-gray-600 hover:text-blue-600">
                                <FaFacebook className="w-6 h-6" />
                            </a>
                            <a href="#" className="text-gray-600 hover:text-blue-600">
                                <FaTwitter className="w-6 h-6" />
                            </a>
                            <a href="#" className="text-gray-600 hover:text-blue-600">
                                <FaInstagram className="w-6 h-6" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="border-t mt-8 pt-8 text-center text-gray-600">
                    <p>&copy; {new Date().getFullYear()} ParkingLot. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

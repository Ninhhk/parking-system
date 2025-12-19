import Image from "next/image";
import Link from "next/link";
import { MdAccessTime, MdSecurity, MdPayment } from "react-icons/md";

export default function Home() {
    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Hero Section */}
            <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20 rounded-xl">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between">
                        <div className="md:w-1/2 mb-10 md:mb-0">
                            <h1 className="text-4xl md:text-5xl font-bold mb-6">Smart Parking Management System</h1>
                            <p className="text-xl mb-8">
                                Efficient, secure, and hassle-free parking solutions for your vehicle
                            </p>
                            
                        </div>
                        <div className="md:w-1/2">
                            <Image
                                src="/parking-illustration.svg"
                                alt="Parking Illustration"
                                width={600}
                                height={400}
                                className="w-full"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-gray-50 mt-8 rounded-xl">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                <MdAccessTime className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Real-time Availability</h3>
                            <p className="text-gray-600">
                                Check parking spot availability in real-time and book instantly
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                <MdSecurity className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Secure Parking</h3>
                            <p className="text-gray-600">
                                24/7 surveillance and security personnel for your vehicle's safety
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                <MdPayment className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Easy Payment</h3>
                            <p className="text-gray-600">Multiple payment options and contactless transactions</p>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}

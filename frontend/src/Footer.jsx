import { CarFront, CircleParking, ArrowDown } from "lucide-react";
import { sendLocation } from "./api/sendLocation";

function Footer({ setCurrentLocation, userId }) {
    const handleParkClick = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setCurrentLocation(location);
                    sendLocation(userId, location); // Send location to backend
                    console.log(location);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    alert(
                        "Unable to get your location. Please enable location services.",
                    );
                },
            );
        } else {
            alert("Geolocation is not supported by your browser");
        }
    };

    return (
        <div className="fixed bottom-0 z-10 flex w-screen flex-col items-center">
            <div className="flex h-6 w-24 translate-y-[2px] items-center justify-center rounded-t-2xl border-2 border-b-0 border-slate-700 bg-white">
                <ArrowDown size={20} color="#2e2e2e" />
            </div>
            <div className="flex h-20 w-screen justify-between border-t-2 border-slate-700 bg-white p-4">
                <button className="flex items-center gap-2 rounded-xl border-2 border-slate-600 p-4 transition-colors hover:cursor-pointer hover:bg-sky-100">
                    <CarFront size={32} color="#2e2e2e" />
                    <h3 className="text-2xl font-medium text-gray-800">
                        Drive
                    </h3>
                </button>
                <button
                    className="flex items-center gap-2 rounded-xl border-2 border-slate-600 p-4 transition-colors hover:cursor-pointer hover:bg-red-100"
                    onClick={handleParkClick}
                >
                    <CircleParking size={32} color="#2e2e2e" />
                    <h3 className="text-2xl font-medium text-gray-800">Park</h3>
                </button>
            </div>
        </div>
    );
}

export default Footer;

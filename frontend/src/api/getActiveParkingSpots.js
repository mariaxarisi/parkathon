import axios from "axios";

export const getActiveParkingSpots = async (userId) => {
    try {
        const response = await axios.get(
            `http://localhost:9000/park/list/active?user=${userId}`
        );
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.error("Error getting active parking spots:", error.response.data.error);
        throw error;
    }
};
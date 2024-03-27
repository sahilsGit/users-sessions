"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
async function getMonthlyLoggedInUsers(db) {
    try {
        const monthlyLoginPipeline = [
            {
                $project: {
                    userId: 1,
                    month: {
                        $month: "$logged_in",
                    },
                    year: {
                        $year: "$logged_in",
                    },
                },
            },
            {
                $group: {
                    _id: {
                        month: "$month",
                        year: "$year",
                    },
                    users: {
                        $addToSet: "$userId",
                    },
                },
            },
            {
                $project: {
                    month: "$_id.month",
                    year: "$_id.year",
                    users: 1,
                    _id: 0,
                },
            },
            {
                $sort: {
                    login_period: 1,
                },
            },
        ];
        const monthlyActivePipeline = [
            {
                $project: {
                    logged_in: {
                        month: {
                            $month: "$logged_in",
                        },
                        year: {
                            $year: "$logged_in",
                        },
                    },
                    logged_out: {
                        month: {
                            $month: "$logged_out",
                        },
                        year: {
                            $year: "$logged_out",
                        },
                    },
                    lastSeenAt: {
                        month: {
                            $month: "$lastSeenAt",
                        },
                        year: {
                            $year: "$lastSeenAt",
                        },
                    },
                },
            },
        ];
        const [monthlyLoggedInUsers, sessionDetails] = await Promise.all([
            db
                .collection("sessions")
                .aggregate(monthlyLoginPipeline)
                .toArray(),
            db
                .collection("sessions")
                .aggregate(monthlyActivePipeline)
                .toArray(),
        ]);
        return [monthlyLoggedInUsers, sessionDetails];
    }
    catch (error) {
        console.error("Error Fetching monthly logged-in and active users:", error);
        throw error;
    }
}
async function main() {
    console.log(process.env.DATABASE);
    const client = await mongodb_1.MongoClient.connect(process.env.DATABASE);
    const db = client.db("test");
    try {
        const [monthlyLoggedInStats, sessionDetails] = await getMonthlyLoggedInUsers(db);
        const activeUsersMap = {};
        function updateActiveUsersMap(sessionDetails, activeUsersMap) {
            for (const session of sessionDetails) {
                const { logged_in, logged_out, lastSeenAt } = session;
                const lastSeenAtKey = `${lastSeenAt.month}-${lastSeenAt.year}`;
                if (lastSeenAtKey) {
                    for (let month = logged_in.month; month <= lastSeenAt.month; month++) {
                        const key = `${month}-${logged_in.year}`;
                        activeUsersMap[key] = (activeUsersMap[key] || 0) + 1;
                    }
                }
                else {
                    for (let month = logged_in.month; month <= logged_out.month; month++) {
                        const key = `${month}-${logged_in.year}`;
                        activeUsersMap[key] = (activeUsersMap[key] || 0) + 1;
                    }
                }
            }
            return activeUsersMap;
        }
        const updatedActiveUsersMap = updateActiveUsersMap(sessionDetails, activeUsersMap);
        const exampleMonthlyLoggedIn = [
            {
                users: ["123432", "123434"],
                month: 2,
                year: 2024,
            },
            {
                users: ["123433"],
                month: 3,
                year: 2024,
            },
        ];
        const exampleMonthlyActive = {
            "2-2024": 2,
            "3-2024": 2,
            "4-2024": 1,
            "5-2024": 1,
            "6-2024": 1,
        };
        console.log(monthlyLoggedInStats, updatedActiveUsersMap);
    }
    catch (error) {
        console.error("Error:", error);
    }
    finally {
        client.close();
    }
}
main().catch(console.error);
//# sourceMappingURL=index.js.map
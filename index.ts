import { MongoClient, Db, ObjectId } from "mongodb";

interface UserSession {
  _id: ObjectId;
  userId: string;
  logged_in: Date;
  logged_out: Date | null;
  lastSeenAt: Date;
}

async function getMonthlyLoggedInUsers(db: Db) {
  try {
    // Pipeline for retrieving monthly logged in users
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

    // Pipeline for monthly active users
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
        .collection<UserSession>("sessions")
        .aggregate(monthlyLoginPipeline)
        .toArray(),
      db
        .collection<UserSession>("sessions")
        .aggregate(monthlyActivePipeline)
        .toArray(),
    ]);

    return [monthlyLoggedInUsers, sessionDetails];
  } catch (error) {
    console.error("Error Fetching monthly logged-in and active users:", error);
    throw error;
  }
}

// Example usage
async function main() {
  // Connect to client

  const client = await MongoClient.connect(
    "" // Enter Database URL or use environment variable here
  );

  // Database
  const db = client.db("test");

  try {
    const [monthlyLoggedInStats, sessionDetails] =
      await getMonthlyLoggedInUsers(db);

    // Map to store monthly active users Details
    const activeUsersMap = {};

    function updateActiveUsersMap(sessionDetails, activeUsersMap) {
      // Loop through session entries
      for (const session of sessionDetails) {
        const { logged_in, logged_out, lastSeenAt } = session;

        // Create a key from lastSeenAt
        const lastSeenAtKey = `${lastSeenAt.month}-${lastSeenAt.year}`;

        /**
         * If lastSeen is present, then starting from "login_month", deem the
         * user as active throughout the all the months months till they are last
         * seen or they log out
         */

        /**
         * Let's say user logs in on January 2nd, and is last seen on June 2
         * Then Deem the user active between all that months that come in between
         * i.e., January, February, March, April, May & June
         */

        if (lastSeenAtKey) {
          for (
            let month = logged_in.month;
            month <= lastSeenAt.month;
            month++
          ) {
            const key = `${month}-${logged_in.year}`;
            activeUsersMap[key] = (activeUsersMap[key] || 0) + 1;
          }
        } else {
          /**
           * If lastSeen is absent, then starting from "login_month", deem the
           * user as active throughout the all the months months till they
           * log out
           */

          for (
            let month = logged_in.month;
            month <= logged_out.month;
            month++
          ) {
            const key = `${month}-${logged_in.year}`;
            activeUsersMap[key] = (activeUsersMap[key] || 0) + 1;
          }
        }
      }

      return activeUsersMap;
    }

    const updatedActiveUsersMap = updateActiveUsersMap(
      sessionDetails,
      activeUsersMap
    );

    /**
     *
     * Here's an example monthly logged in users return value
     */

    const exampleMonthlyLoggedIn = [
      {
        users: ["123432", "123434"], // userIds of the users
        month: 2, // Month number
        year: 2024, // year number
      },
      {
        users: ["123433"], // userIds of the users
        month: 3, // Month number
        year: 2024, // year number
      },
    ];

    /**
     *
     * Here's an example monthly active users return value
     */
    const exampleMonthlyActive = {
      "2-2024": 2, // Number of users active on February 2024
      "3-2024": 2,
      "4-2024": 1,
      "5-2024": 1,
      "6-2024": 1,
    };

    console.log(monthlyLoggedInStats, updatedActiveUsersMap);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.close();
  }
}

main().catch(console.error);

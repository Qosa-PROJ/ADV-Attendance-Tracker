import React from "react";
import { Image } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import HomeContent from "./HomeContent";
import AttendanceScreen from "./AttendanceScreen";
import CalendarScreen from "./CalendarScreen";
import SeatingScreen from "./SeatingScreen";
import ReportsScreen from "./ReportsScreen";
import ProfileScreen from "./ProfileScreen";

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: require("../../assets/home.png"),
  Attendance: require("../../assets/attendance.png"),
  Calendar: require("../../assets/calendar.png"),
  Seating: require("../../assets/seats.png"),
  Reports: require("../../assets/report.png"),
  Profile: require("../../assets/user.png"),
};

export default function HomeScreen({ onSignOut }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const source = ICONS[route.name];
          return (
            <Image
              source={source}
              style={{ width: size, height: size, tintColor: color }}
              resizeMode="contain"
            />
          );
        },
        tabBarActiveTintColor: "#CC0000",
        tabBarInactiveTintColor: "#555555",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeContent} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Seating" component={SeatingScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

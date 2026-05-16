import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth } from "../FireBase/FireBaseConfig";

import MainScreen from "../screens/MainScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";

const Stack = createNativeStackNavigator();

let isRegistering = false;
export const setIsRegistering = (val) => {
  isRegistering = val;
};

export default function AppNavigator() {
  const [authStatus, setAuthStatus] = useState("loading");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      if (isRegistering) return;
      if (currentUser) {
        setAuthStatus("authed");
        return;
      }
      setAuthStatus((prev) => (prev === "login" ? "login" : "guest"));
    });
    return unsubscribe;
  }, []);

  if (authStatus === "loading") return null;

  const onRegistered = () => {
    isRegistering = false;
    setAuthStatus("login");
  };

  const onSignOut = () => setAuthStatus("guest");

  if (authStatus === "authed") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" options={{ animationEnabled: false }}>
          {(props) => <HomeScreen {...props} onSignOut={onSignOut} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (authStatus === "login") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animationEnabled: false }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Main"
        component={MainScreen}
        options={{ animationEnabled: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ animationEnabled: false }}
      />
      <Stack.Screen name="Register" options={{ animationEnabled: false }}>
        {(props) => <RegisterScreen {...props} onRegistered={onRegistered} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

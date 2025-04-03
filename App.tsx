// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ConversationDetail from './app/ConversationDetail';
import SearchResults from './app/SearchResults';

export type RootStackParamList = {
  index: undefined; // "index" is now the main screen
  ConversationDetail: { transcription: string; audioUri: string };
  SearchResults: { results: string[] };
};

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="index">
        <Stack.Screen name="index" component={require('./app/index').default} /> {/* Reference index.tsx directly */}
        <Stack.Screen name="ConversationDetail" component={ConversationDetail} />
        <Stack.Screen name="SearchResults" component={SearchResults} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;

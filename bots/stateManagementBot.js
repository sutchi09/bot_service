// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// const { ActivityHandler } = require('botbuilder');
const { ActivityHandler, MessageFactory } = require('botbuilder');
const { ActionTypes } = require('botframework-schema');

flow = {
    '1':{
        'Question':'画面の電源は点灯していますか？',
        'Answers':[
            {
                type: ActionTypes.PostBack,
                title: '点灯',
                value: '2',
            },
            {
                type: ActionTypes.PostBack,
                title: '消灯',
                value: '3',
            }
        ]
    },
    '2':{
        'Question':'HDMIケーブルは刺さっていますか？',
        'Answers':[
            {
                type: ActionTypes.PostBack,
                title: '刺さっている',
                value: '4',
            },
            {
                type: ActionTypes.PostBack,
                title: '刺さっていない',
                value: '5',
            }
        ]
    },
    '3':{
        'Question':'画面の電源を点けてください',
        'Answers':'-'
    },
    '4':{
        'Question':'原因が分かりません。電話でお問い合わせください',
        'Answers':'-'
    },
    '5':{
        'Question':'HDMIケーブルを差して下さい',
        'Answers':'-'
    }
}

flows = ['1','2','3']

// The accessor names for the conversation data and user profile state property accessors.
const CONVERSATION_DATA_PROPERTY = 'conversationData';
const USER_PROFILE_PROPERTY = 'userProfile';

class StateManagementBot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();
        // Create the state property accessors for the conversation data and user profile.
        this.conversationDataAccessor = conversationState.createProperty(CONVERSATION_DATA_PROPERTY);
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);

        // The state management objects for the conversation and user state.
        this.conversationState = conversationState;
        this.userState = userState;

        this.onMessage(async (turnContext, next) => {
            const userProfile = await this.userProfileAccessor.get(turnContext, {});
            const conversationData = await this.conversationDataAccessor.get(
                turnContext, { promptedForUserName: false });
            
            //ユーザプロファイルが無い場合
            if(!userProfile.name){
                //フローの詳細情報を取得し、userProfileに格納する
                userProfile.name = 'username'
                if(flows.includes(turnContext.activity.text)){
                    //フローIDの格納
                    userProfile.flow = turnContext.activity.text
                    //SQL Databaseから情報を取得する処理を入れる。
                    //SQL文の実行をする箇所
                    var flow_detail = flow 
                    //SQL分で取得したデータを入れる
                    userProfile.flow_detail = flow_detail
                    //userProfileに最初のフロー詳細IDを入れる
                    userProfile.status = 1
                    await turnContext.sendActivity(MessageFactory.suggestedActions(
                        userProfile.flow_detail[userProfile.status]['Answers'],
                        userProfile.flow_detail[userProfile.status]['Question']
                    ));
                }
                else {
                    //フロー選択を再度実施
                    await this.sendWelcomeMessage(context);
                }
            }
            else{
                //ユーザの選択した結果が、現在のフロー詳細の回答か確認する 
                //現在のフロー詳細の回答内容の一覧を取得し、userProfile.checkに格納する
                var check_list = [];
                var check_ok = [];
                check_list = userProfile.flow_detail[userProfile.status]['Answers']

                for(var i=0;i < check_list.length;i++){
                    check_ok.push(check_list[i]['value'])
                }
                userProfile.check = check_ok

                //入力値がフロー詳細の情報の場合かつ、入力値が提示した選択肢であった場合
                if(userProfile.check.includes(turnContext.activity.text) == true){
                    console.log('Check Flow_Detail');
                    //次のフロー詳細がない場合は、回答を提示するのみ
                    if(userProfile.flow_detail[turnContext.activity.text]['Answers'] == '-'){
                        await turnContext.sendActivity(userProfile.flow_detail[turnContext.activity.text]['Question']);
                    }
                    //次のフローがある場合は、次のフローの情報を取得し、質問内容を提示する
                    else{
                        //userProfileから次のフロー情報を取得し、提示する
                        await turnContext.sendActivity(MessageFactory.suggestedActions(
                            userProfile.flow_detail[turnContext.activity.text]['Answers'],
                            userProfile.flow_detail[turnContext.activity.text]['Question']
                            ));
                        //フロー詳細IDの更新
                        userProfile.status = turnContext.activity.text
                    }
                }
                //フローのIDが直接入力された場合
                else {
                    //指定されたIDのフローの情報を取得し、選択肢を提示する
                    //ただし、現時点ではその処理は入れず、正しいFlowの情報を入れてもらうよう依頼する
                    if(userProfile.flow_detail[turnContext.activity.text]['Answers'] == '-'){
                        await turnContext.sendActivity(userProfile.flow_detail[turnContext.activity.text]['Question']);
                    }
                    //次のフローがある場合は、次のフローの情報を取得し、質問内容を提示する
                    else{
                        await turnContext.sendActivity(MessageFactory.suggestedActions(
                            userProfile.flow_detail[turnContext.activity.text]['Answers'],
                            userProfile.flow_detail[turnContext.activity.text]['Question']
                            ));
                            //フロー詳細IDの更新
                            userProfile.status = turnContext.activity.text
                    }
                }
            }
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await this.sendWelcomeMessage(context);
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;
        // Iterate over all new members added to the conversation.
        for (const idx in activity.membersAdded) {
            if (activity.membersAdded[idx].id !== activity.recipient.id) {
                const welcomeMessage = 'Bot Serviceのテストプログラムへようこそ';
                await turnContext.sendActivity(welcomeMessage);
                await this.sendSuggestedActions(turnContext);
            }
        }
    }
    async sendSuggestedActions(turnContext) {
        const cardActions = [
            {
                type: ActionTypes.PostBack,
                title: 'モニターが点かない時のフロー',
                value: '1'
                // image: 'https://via.placeholder.com/20/FF0000?text=R',
                // imageAltText: 'R'
            }
            // {
            //     type: ActionTypes.PostBack,
            //     title: 'Flow_2',
            //     value: '2'
            //     // image: 'https://via.placeholder.com/20/FFFF00?text=Y',
            //     // imageAltText: 'Y'
            // }
        ];


        var reply = MessageFactory.suggestedActions(cardActions, 'どのフローを選択しますか？');
        await turnContext.sendActivity(reply);
    }
    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context);

        // Save any state changes. The load happened during the execution of the Dialog.
        await this.conversationState.saveChanges(context, false);
        await this.userState.saveChanges(context, false);
    }
}

module.exports.StateManagementBot = StateManagementBot;

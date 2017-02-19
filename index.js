'use strict';
module.change_code = 1;
var Skill = require('alexa-app');
var skillService = new Skill.app('cook_for_me');
var Set = require("collections/set");
var State_helper = require('./state_helper');
var Rest_client = require('./rest_client');
var SESSION_KEY = "user_session";
var DatabaseHelper = require('./database_helper');
var databaseHelper = new DatabaseHelper();
skillService.pre = function (request, response, type) {
    databaseHelper.createRecipeTable();
};

var getStateManager = function (stateManagerData) {
    if (stateManagerData === undefined)stateManagerData = {};
    return new State_helper(stateManagerData);
};

var getStateManagerFromRequest = function (request) {
    var helperData = request.session(SESSION_KEY);
    return getStateManager(helperData);
};

var storeData = function (userId, stateManager) {
    databaseHelper.storeRecipeData(userId, stateManager).then(
        function (result) {
            return result;
        }).catch(function (error) {
        console.log(error);
    });
};

var cancelIntentFunction = function (request, response) {
    response.say("GoodBye!").shouldEndSession(true);
};
var reprompt = "I didnt hear anything. ";

skillService.launch(function (request, response) {
    databaseHelper.readRecipeData(request.userId).then(
        function (result) {
            console.log("got", result);
            var stateManager = result;
            if (stateManager.currentState == "step_by_step") {
                stateManager.currentState = "continue_state";
                console.log(stateManager.getCurrentState());
            }else{
                stateManager.currentState="start";
            }
            response.say(stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
            response.session(SESSION_KEY, stateManager);

        });
    return false;
});

skillService.intent("AMAZON.CancelIntent", {}, cancelIntentFunction);
skillService.intent("AMAZON.StopIntent", {}, cancelIntentFunction);
skillService.intent("AMAZON.HelpIntent", {},
    function (request, response) {
        var stateManager = getStateManagerFromRequest(request);
        response.say(stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    });

skillService.intent("load_intent", {
    'utterances': ['{|load} {favorite|favorites|saved} {|recipe|recipes}']},
    function (request, response) {
        var stateManager = getStateManagerFromRequest(request);
        var saved_recipes=stateManager.savedRecipes;
        if(saved_recipes.length>0){
            var talk = "";
            for (var i = 0; i < saved_recipes.length; i++) {
                if (saved_recipes[i].title) {
                    talk += (i + 1).toString() + ". " + saved_recipes[i].title + ". ";
                }
            }
            stateManager.currentState = 'search_choices';
            var state = stateManager.getCurrentState();
            state.response = saved_recipes;
            talk = talk.replace(/&/g, 'and');
            response.say(stateManager.getPrompt() + ". " + talk + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
            response.session(SESSION_KEY, stateManager);
        }else{
            response.say("you have no saved recipes").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
        }
    });
skillService.intent("continueIntent", {
    'slots': {
        'CONTINUE': 'CONTINUETYPE'
    },
    'utterances': ['{-|CONTINUE}']
}, function (request, response) {
    databaseHelper.readRecipeData(request.userId).then(
        function (result) {
            console.log("got", result);
            var stateManager = result;
            var state;
            if (stateManager == undefined) {
                stateManager = getStateManagerFromRequest(request);
            }
            if (stateManager.currentState == "step_by_step") {
                stateManager.currentState = "continue_state";
                state = stateManager.getCurrentState();
                console.log(state);
            }
            var user_response = request.slot('CONTINUE');
            console.log(user_response);
            if (stateManager.currentState == "continue_state") {
                if (user_response == "continue") {
                    stateManager.currentState = "step_by_step";
                    state = stateManager.getCurrentState();
                    var steps_arr = state.response;
                    response.say(steps_arr[state.step]).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
                    response.session(SESSION_KEY, stateManager);
                } else if (user_response == "new session") {
                    stateManager.currentState = "start";
                    response.say(stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
                    response.session(SESSION_KEY, stateManager);
                } else {
                    response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
                }
            } else {
                response.say("I didnt find any session to continue. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
            }
        });
    return false;
});

skillService.intent("searchIntent", {
    'slots': {
        'SEARCH': 'SEARCHTYPE'
    },
    'utterances': ['{search|find} {|by} {-|SEARCH}']
}, function (request, response) {
    var stateManager = getStateManagerFromRequest(request);
    stateManager.currentState = "search";
    var searchType = request.slot('SEARCH');
    console.log(searchType);
    if (searchType == "keywords" || searchType == "keyword") {
        stateManager.currentState = "keywords";
        response.say(stateManager.getPrompt()).reprompt(reprompt).shouldEndSession(false);
        response.session(SESSION_KEY, stateManager);
    } else if (searchType == "ingredients" || searchType == "ingredient") {
        stateManager.currentState = "ingredients";
        response.say(stateManager.getPrompt()).reprompt(reprompt).shouldEndSession(false);
        response.session(SESSION_KEY, stateManager);
    } else {
        response.say("I didnt understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    }
});

skillService.intent("queryIntent", {
    'slots': {
        'QUERY': 'AMAZON.Food'
    },
    'utterances': ['{-|QUERY}']
}, function (request, response) {
    var stateManager = getStateManagerFromRequest(request);
    var state = stateManager.getCurrentState();
    var query = request.slot('QUERY');
    console.log(stateManager.currentState);
    if (stateManager.currentState == "keywords") {
        stateManager.currentState = "keywords1";
        state = stateManager.getCurrentState();
        state.response = [request.slot('QUERY')];
        response.say("I added " + query + ". " + stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    } else if (stateManager.currentState == "keywords1") {
        state.response.push(request.slot('QUERY'));
        response.say("I added " + query + ". " + stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    } else if (stateManager.currentState == "ingredients") {
        stateManager.currentState = "ingredients1";
        state = stateManager.getCurrentState();
        state.response = [request.slot('QUERY')];
        response.say("I added " + query + ". " + stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    } else if (stateManager.currentState == "ingredients1") {
        state.response.push(request.slot('QUERY'));
        response.say("I added " + query + ". " + stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    } else {
        response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    }
    response.session(SESSION_KEY, stateManager);
});

skillService.intent("storedRecipesIntent", {
        'utterances': ['{stored} {recipes}']
}, function (request, response) {
    response.say("This feature is not available for free tier. Pay $2000 to get this feature.");
    console.log(databaseHelper.readRecipeData("test"))
});

skillService.intent("beginSearchIntent", {
    'utterances': ['{begin} {search}']
}, function (request, response) {
    var stateManager = getStateManagerFromRequest(request);
    var state = stateManager.getCurrentState();
    console.log(stateManager.currentState);
    if (state.response == null) {
        response.say("You did not specify any search terms. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    } else {
        var callback = function (result) {
            console.log(result);
            var results = result;
            if (results.length > 0) {
                var talk = "";
                var recipes = [];
                for (i = 0; i < results.length; i++) {
                    if (results[i].title) {
                        talk += (i + 1).toString() + ". " + results[i].title + ". ";
                        recipes.push({
                            "id":results[i].id,
                            "title":results[i].title
                        });
                    }
                }
                stateManager.currentState = 'search_choices';
                state = stateManager.getCurrentState();
                state.response = recipes;
                talk = talk.replace(/&/g, 'and');
                response.say(stateManager.getPrompt() + ". " + talk + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
                response.session(SESSION_KEY, stateManager);
            }
            else {
                state.response = null;
                stateManager.currentState = "search";
                response.say("there were no matches for those search terms. Say search by ingredients or search by keywords to try again").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
                response.session(SESSION_KEY, stateManager);
            }
        };
        var restClient = new Rest_client();
        var args = "";
        if (stateManager.currentState == "keywords1") {
            for (var i = 0; i < state.response.length; i++) {
                args += state.response[i] + " ";
            }
            args = args.substring(0, args.length - 1);
            restClient.getListKeywords(args).then(function (result) {
                callback(result.results);
            }).catch(function (err) {
                console.log(err.statusCode);
                var prompt = err.message;
                response.say(prompt).reprompt(reprompt  + stateManager.getHelp()).shouldEndSession(false).send();
            });
        } else if (stateManager.currentState == "ingredients1") {
            for (i = 0; i < state.response.length; i++) {
                args += state.response[i] + ",";
            }
            args = args.substring(0, args.length - 1);
            restClient.getListIngredients(args).then(function (result) {
                callback(result);
            }).catch(function (err) {
                console.log(err.statusCode);
                var prompt = err.message;
                response.say(prompt).reprompt(reprompt  + stateManager.getHelp()).shouldEndSession(false).send();
            });
        }
        return false;
    }
});

skillService.intent("selectIntent", {
    'slots': {
        'SELECT': "NUMBER"
    },
    'utterances': ['{-|SELECT}']
}, function (request, response) {
    var stateManager = getStateManagerFromRequest(request);
    var state = stateManager.getCurrentState();
    var recipes = state.response;
    console.log(request.slot('SELECT'));
    console.log(isNaN(request.slot('SELECT')));
    if (isNaN(request.slot('SELECT'))) {
        response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    }
    else {
        if (request.slot('SELECT') > 0 && request.slot('SELECT') <= recipes.length) {
            console.log("RECIPES!")
            console.log(recipes)
            var recipe_info = recipes[request.slot('SELECT') - 1];
            var id=recipe_info.id;
            stateManager.currentState = "steps_choice";
            var restClient = new Rest_client();
            restClient.getIngredients(id).then(function(result){
                console.log(result);
                var title= result.title;
                var ingredients=result.extendedIngredients;
                state = stateManager.getCurrentState();
                state.ingredients=ingredients;
                response.say("you have selected "+title+". Here are the ingredients.");
                for(var i=0;i<ingredients.length;i++) {
                    response.say(" "+ingredients[i].originalString+".")
                }
                return restClient.getRecipeSteps(id);
            }).then(function (result) {
                console.log(result);
                if (result.length>0 && result[0].steps.length > 0) {
                    var addSpace=function(match){
                        var str_array=match.split(".");
                        return str_array[0]+". "+str_array[1];
                    };
                    var step_arr = [];
                    var steps = result[0].steps;
                    var current_step;
                    for (var i = 0; i < steps.length; i++) {
                        current_step=steps[i].step;
                        current_step=current_step.replace(/.\.\w/,addSpace);
                        step_arr.push(current_step);
                    }
                    state = stateManager.getCurrentState();
                    state.response = step_arr;
                    state.recipe_info=recipe_info;
                    response.say(stateManager.getPrompt()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
                    response.session(SESSION_KEY, stateManager);
                }
                else{
                    stateManager.currentState = "search";
                    response.say("this recipe doesn't seem to have any steps. Say search by ingredients or search by keywords to try again").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false).send();
                    response.session(SESSION_KEY, stateManager);
                }
            }).catch(function (err) {
                console.log(err.statusCode);
                var prompt = err.message;
                response.say(prompt).reprompt(reprompt  + stateManager.getHelp()).shouldEndSession(false).send();
            });
            return false;
        }
        else response.say("that is an invalid selection.").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    }
});

skillService.intent("ingredients_intent",{
    'utterances': ['{what} {|are} {|the} {ingredients}']
}, function(request,response){
    var stateManager = getStateManagerFromRequest(request);
    if(stateManager.currentState == "steps_choice" || stateManager.currentState == "step_by_step"){
        response.say("here are the ingredients.");
        var state=stateManager.getCurrentState();
        var ingredients=state.ingredients;
        for(var i=0;i<ingredients.length;i++){
            response.say(" "+ingredients[i].originalString+".")
        }
    }
    else{
        response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    }
});

skillService.intent("steps_choice_intent", {
    'slots': {
        'STEPS_SELECTION': "STEPS_CHOICE"
    },
    'utterances': ['{-|STEPS_SELECTION}']
}, function (request, response) {
    console.log("steps choice intent");
    var stateManager = getStateManagerFromRequest(request);
    var state = stateManager.getCurrentState();
    if (stateManager.currentState == "steps_choice") {
        var steps_arr = state.response;
        console.log(request.slot("STEPS_SELECTION"));
        if (request.slot("STEPS_SELECTION") == "all at once") {
            var output = "";
            for (var i = 0; i < steps_arr.length; i++) {
                output += steps_arr[i]+" ";
            }
            response.say(output).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
        } else if (request.slot("STEPS_SELECTION") == "step by step") {
            var ingredients=state.ingredients;
            stateManager.currentState = "step_by_step";
            state = stateManager.getCurrentState();
            state.ingredients=ingredients;
            state.step = 0;
            state.response = steps_arr;
            var userId = request.userId;
            storeData(userId, stateManager);
            response.say(steps_arr[0]).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
            response.session(SESSION_KEY, stateManager);
        } else response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    } else response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
});

skillService.intent("step_by_step_intent", {
    'slots': {
        'USERSTEP': "STEPS_MOVE"
    },
    'utterances': ['{-|USERSTEP} {|step}']
}, function (request, response) {
    console.log("step by step intent");
    var stateManager = getStateManagerFromRequest(request);
    var state = stateManager.getCurrentState();
    if (stateManager.currentState == "step_by_step") {
        console.log(request.slot("USERSTEP"));
        var steps_arr = state.response;
        if (request.slot("USERSTEP") == "next") {
            if (state.step < steps_arr.length - 1) {
                state.step++;
                response.say(steps_arr[state.step]).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
            } else {
                response.say("that was the last step").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
            }
        } else if (request.slot("USERSTEP") == "previous") {
            if (state.step > 0) {
                state.step--;
                response.say(steps_arr[state.step]).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
            } else {
                response.say("that was the first step").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
            }
        } else if(request.slot("USERSTEP")=="repeat") {
            response.say(steps_arr[state.step]).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
        }else{
            response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
        }
        var userId = request.userId;
        storeData(userId, stateManager);
        response.session(SESSION_KEY, stateManager);
    } else response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
});

skillService.intent("save_intent",
    {
    'utterances': ['{save} {|recipe}']
    }
    , function (request, response) {
    var stateManager = getStateManagerFromRequest(request);
    if(stateManager.currentState=="steps_choice"||stateManager.currentState=="step_by_step"){
        var recipe_info=stateManager.getRecipeInfo();
        console.log(stateManager.savedRecipes.has(recipe_info));
        if(stateManager.savedRecipes.has(recipe_info)){
            response.say("that recipe is already saved.").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
        }else{
            stateManager.savedRecipes.add(recipe_info);
            var userId = request.userId;
            storeData(userId, stateManager);
            response.say("recipe saved").reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
            response.session(SESSION_KEY, stateManager);
        }
    }else{
        response.say("I didn't understand what you said. " + stateManager.getHelp()).reprompt(reprompt + stateManager.getHelp()).shouldEndSession(false);
    }
});

module.exports = skillService;

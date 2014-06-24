// ==UserScript==
// @name       CS:GO Lounge Destroyer
// @namespace  http://csgolounge.com/
// @version    0.5.1
// @description  Spam the fuck out of the CS:GL queue system, because it's absolute crap
// @match      http://csgolounge.com/*
// @match      http://dota2lounge.com/*
// @updateURL   http://ncla.me/csgl3000/csgl3000.meta.js
// @downloadURL http://ncla.me/csgl3000/csgl3000.user.js
// @require http://code.jquery.com/jquery-2.1.1.js
// @copyright  iamncla @ GitHub.com
// ==/UserScript==
/*
    Chaos is order yet undeciphered.
 */

var Bet3000 = function(matchID) {
    /* Construct */
    var self = this;

    var version = "0.5.1";
    console.log("LoungeDestroyer " + version + " started");
    this.betAttempts = 0;
    this.inventoryAttempts = 0;
    this.returnAttempts = 0;

    // for handling maintainance errors http://csgolounge.com/break and wait.html page
    if(document.URL.indexOf("/wait.html") != -1 || document.URL.indexOf("/break") != -1 || document.title == "The page is temporarily unavailable") {
        window.location = GM_getValue("intendedVisitURL", location.host);
    }

    $("a").click(function(e) {
        if (e.which === 1) {
            e.preventDefault();
            if($(this).attr("href").length > 0) {
                var url = $(this).attr("href");
                GM_setValue("intendedVisitURL", url);
                window.location = url;
            }
        }
    });

    this.placeBet = function() {
        // to do: add exceptions for "you have too many items in your returns"

        if(!this.checkBetRequirements()) return false;
        // returns variable is created by CS:GL page, true if you are using return items.
        var url = (returns == true ? "ajax/postBet.php" : "ajax/postBetOffer.php");
        $.ajax({
                type: "POST",
                url: url,
                data: $("#betpoll").serialize() + "&match=" + self.matchID,
                success: function(data) {
                    if (data) {
                        self.betAttempts = self.betAttempts + 1;
                        console.log("Try Nr." + self.betAttempts + ", server denied our bet: " + data);
                        self.placeBet();
                    } else {
                        alert("It seems we successfully placed a bet! It took " + self.betAttempts + " tries to place the bet.");
                        window.location.href = "mybets";
                    }
                }
            });
    }
    this.checkBetRequirements = function() {
        if(!$(".betpoll .item").length > 0) { 
            alert("No items added!");
            return false;
        }
        if(!$("#on").val().length > 0) {
            alert("No team selected!");
            return false;
        }
        return true;
    }
    this.getInventoryItems = function() {
        if (typeof ChoseInventoryReturns == 'function') {
            var basher = setInterval(function() {
                if($("#backpack .standard").text().indexOf("Can't get items.") == -1) {
                    clearInterval(basher);
                    $("#showinventorypls").hide();
                    return true;
                }
                var steamAPI = ((Math.floor(Math.random() * (1 - 0 + 1)) + 0) == 0 ? "betBackpackApi" : "betBackpack");
                ChoseInventoryReturns(steamAPI);
                self.inventoryAttempts = self.inventoryAttempts + 1;
                console.log("Attempting to get your Steam inventory, try Nr." + self.inventoryAttempts);
            }, 2000); // A little more gentle on bashing servers, because it's Volvo, not CS:GL
        }
    }
    this.requestReturns = function() {
        // Try Nr.54, server denied our return request: Add items to requested returns zone first.
        // if FALSE, then the items need to be frozen
        // if TRUE, then the items need to be requested for the actual trade
        var ajaxProperties = { url: (toreturn ? "ajax/postToReturn.php" : "ajax/postToFreeze.php") };
        if(toreturn) {
            ajaxProperties.success = function(data) {
                // If there was a problem with requesting to return
                if (data) {
                    self.returnAttempts = self.returnAttempts + 1;
                    console.log("Try Nr." + self.returnAttempts + ", server denied our return request: " + data);
                    self.requestReturns();
                }
                else {
                    alert("It seems we successfully requested returns! It took " + self.returnAttempts + " tries to request returns.");
                    window.location.href = "mybets";
                    localStorage.playedreturn = false;
                }
            }
        }
        else {
            ajaxProperties.type = "POST";
            ajaxProperties.data = $("#freeze").serialize();
            ajaxProperties.success = function(data) {
                if (data) {
                    window.alert(data);
                }
                else {
                    toreturn = true;
                    self.requestReturns();
                }
            }
        }
        $.ajax(ajaxProperties);
    }
    this.getMarketPrice = function(item) {
        var name = $(".smallimg", item).attr("alt");
        if(!$(item).hasClass("marketPriced") && nonMarketItems.indexOf(name) == -1 && nonMarketItems.indexOf($(".rarity", item).text()) == -1 && !$(item).hasClass("loadingPrice")) {
            $(item).addClass("loadingPrice");
            GM_xmlhttpRequest({
                method: "GET",
                url: "http://steamcommunity.com/market/priceoverview/?country=US&currency=1&appid=730&market_hash_name=" + encodeURI(name),
                onload: function(response) {
                    var responseParsed = JSON.parse(response.responseText);
                    if(responseParsed.success == true && responseParsed.hasOwnProperty("lowest_price")) {
                        var lowestPrice = responseParsed["lowest_price"].replace("&#36;", "&#36; ");
                        $(item).find('.rarity').html(lowestPrice);
                        $(item).addClass('marketPriced');
                        $(".item").each(function() {
                            if ($(this).find('img.smallimg').attr("alt") == name && !$(this).hasClass('marketPriced')) {
                                $(this).find('.rarity').html(lowestPrice);
                                $(this).addClass('marketPriced');
                            }
                        });
                    }
                    else {
                        $(item).find('.rarity').html('Not Found');
                    }
                    $(item).removeClass("loadingPrice");
                }
            });
        }
    }
    this.bumpTrade = function(tradeID) {
        $.ajax({
            type: "POST",
            url: "ajax/bumpTrade.php",
            data: "trade=" + tradeID,
            async: false,
            success: function(data) {
                console.log((new Date()) + " -- Bumped trade offer #" +tradeID);
            }
        });
    }
    this.startAutobump = function() {
        if($(".tradeheader").text().indexOf("minute") == -1 && $(".tradeheader").text().indexOf("second") == -1) {
            // force bump
            var delayMinutes = 0;
        }

        if($(".tradeheader").text().indexOf("second") != -1 || $(".tradeheader").text().indexOf("just now") != -1) {
            var delayMinutes = 30;
        }
        if($(".tradeheader").text().indexOf("minute") != -1) {
            var numberino = $(".tradeheader").text().replace(" minutes ago", "").replace(" minute ago", "");
            var delayMinutes = (numberino >= 30) ? 0 : (30 - numberino);
        }
        console.log(new Date() + " -- Auto-bumping in " + delayMinutes + " minutes");
        // start the vicious cycle
        var autoBump = setTimeout(function() {
            console.log(new Date() + " -- Auto-bumping");
            self.bumpTrade(Bet.tradeID);
            self.updateLastBumped();
            self.startAutobump();
        }, (delayMinutes * 60 * 1000))
    }
    this.stopAutobump = function() {
        console.log((new Date()) + " -- Stopping auto-bumping");
        clearTimeout(autoBump);
    }
    this.updateLastBumped = function() {
        $.ajax({
            type: "GET",
            url: window.location.href,
            async: false
        }).done(function(data) {
            var lastUpdated = $(data).find(".tradeheader").text();
            $(".tradeheader").html(lastUpdated);
            console.log((new Date()) + " -- Updated last-updated element: " + lastUpdated);
        })
    }
}

var nonMarketItems = ["Dota Items", "Any Offers", "Knife", "Gift"];

var Bet = new Bet3000();

var autoBump; // global variable for autobump timeouts

$(document).on("mouseover", ".item", function() {
    Bet.getMarketPrice(this);
})
if(document.URL.indexOf("/match") != -1) {
    $("#placebut").before("<a class='buttonright' id='realbetbutton'>FUCKING PLACE A BET</a>");
    Bet.matchID = gup("m");
    $("#realbetbutton").click(function() {
        Bet.placeBet();
    });
    // Okay, Bowerik or whoever designs and codes this shit.. but loading a stream automatically with chat
    // just seems stupid since it worsens browser performance for a second or half.
    $("#stream object, #stream iframe").remove();
    if($("#stream .tab").text().indexOf("English Stream") != -1) {
        $("#stream .tab").contents().first().wrap("<span class='stream-placeholder'/>");
        var streamLang = $(".stream-placeholder").text().trim().replace(" Stream", "");
        var dup = $("#stream .subtabs .tab:first").clone();
        dup.attr("onclick", "choseStream(" + Bet.matchID + ", '" + streamLang + "')");
        dup.html(streamLang + " Stream");
        $("#stream .subtabs").prepend(dup);
        $("#stream .stream-placeholder").html("Select stream");
    }
}

if(document.URL.indexOf("/trade?t=") != -1) {
    Bet.tradeID = gup("t");

    var autobumpBtn = $("<a class='buttonright autobump'>Auto-bump: <span class='status'>Off</span></a>");
    $(".box-shiny-alt .half:eq(1)").append(autobumpBtn);

    Bet.autobump = false;
    $(".autobump").click(function() {
        Bet.autobump = (Bet.autobump == false) ? true : false;
        if(Bet.autobump) {
            Bet.updateLastBumped();
            Bet.startAutobump();
        }
        else {
            Bet.stopAutobump();
        }
        var btnText = (Bet.autobump) ? "On" : "Off";
        $(".autobump .status").html(btnText);
    })
    $(".box-shiny-alt .half:eq(1)").append("<a class='buttonright justbump'>Bump</a>");
    $(".justbump").click(function() {
        Bet.bumpTrade();

    })
}

if($("#backpack").length) {
    if($("#backpack #loading").length) {
        // DOMSubtreeModified might have poor support
        $("#backpack").bind("DOMSubtreeModified", function(event) {
            if($("#backpack .standard").text().indexOf("Can't get items.") != -1) {
                $("#backpack").unbind();
                $("#backpack").before("<a class='buttonright' id='showinventorypls'>FUCKING GET MY INVENTORY</a>");
                $("#showinventorypls").click(function() {
                    Bet.getInventoryItems();
                })
            }
        })
    }
}
if($("#freezebutton").length) {
    $("#freezebutton").after("<a class='buttonright' id='returnitemspls'>RETURN MY FUCKING ITEMS</a>");
    $("#returnitemspls").click(function() {
        Bet.requestReturns();
    })
}

if($("#submenu").length) {
    $("#submenu div:eq(0)").append('<a href="http://steamcommunity.com/tradeoffer/new/?partner=106750833&token=CXFPs7ON" title="Support LoungeDestroyer further development">LoungeDestroyer &#x2764;</a>')
}

function gup(name) {
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
        return null;
    else
        return results[1];
}
# 国标81番种覆盖矩阵

冻结：WMO 官网2014发布中文文本附件一。实现入口 scoring.ts / shapes.ts / vendor/jan/mcr-util.js；独立固定正例位于 src/game/guobiao/fanCoverage.test.ts，每个ID一个命名测试。

每行均检查正例、合法无番和负例（无番和使用箭刻负例）、牌序/副露反序不变性、非法数量。独立14张第五张边界与7/8番、特殊手形、暗杠次数和实际总分见 scoring.test.ts；15组高番排除见 fanCoverage.test.ts。通用负例证明本番不普遍成立，不宣称穷尽每个近邻牌形。

|序号|名称/值|检测ID及完整正例牌形（副露/条件见fixture）|反例/边界|排除|来源|
|---|---|---|---|---|---|
|1|大四喜 88|BIG_FOUR_WINDS：EEE SSS WWW NNN 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 1|
|2|大三元 88|BIG_THREE_DRAGONS：PPP FFF CCC 123m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 2|
|3|绿一色 88|ALL_GREEN：222333444666s FF|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 3|
|4|九莲宝灯 88|NINE_GATES：1112345678999m 5m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 4|
|5|四杠 88|FOUR_KONGS：55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 5|
|6|连七对 88|SEVEN_SHIFTED_PAIRS：11223344556677m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 6|
|7|十三幺 88|THIRTEEN_ORPHANS：19m 19p 19s ESWNPFC 1m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 7|
|8|清幺九 64|ALL_TERMINALS：111999m 111p 999s 99p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 8|
|9|小四喜 64|LITTLE_FOUR_WINDS：EEE SSS WWW 123m NN|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 9|
|10|小三元 64|LITTLE_THREE_DRAGONS：PPP FFF 123m 789p CC|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 10|
|11|字一色 64|ALL_HONORS：EEE SSS PPP FFF CC|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 11|
|12|四暗刻 64|FOUR_CONCEALED_PUNGS：222m 444p 666s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 12|
|13|一色双龙会 64|PURE_TERMINAL_CHOWS：123123789789m 55m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 13|
|14|一色四同顺 48|QUADRUPLE_CHOW：123123123123m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 14|
|15|一色四节高 48|FOUR_PURE_SHIFTED_PUNGS：111222333444m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 15|
|16|一色四步高 32|FOUR_PURE_SHIFTED_CHOWS：123345567789m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 16|
|17|三杠 32|THREE_KONGS：123s 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 17|
|18|混幺九 32|ALL_TERMINALS_AND_HONORS：111m 999p EEE CCC NN|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 18|
|19|七对 24|SEVEN_PAIRS：11m 33m 55p 77p 99s EE CC|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 19|
|20|七星不靠 24|GREATER_HONORS_AND_KNITTED_TILES：147m 258p 3s ESWNPFC|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 20|
|21|全双刻 24|ALL_EVEN_PUNGS：222m 444p 666s 888m 22p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 21|
|22|清一色 24|FULL_FLUSH：123456789m 222m 55m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 22|
|23|一色三同顺 24|PURE_TRIPLE_CHOW：123123m 789p 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 23|
|24|一色三节高 24|PURE_SHIFTED_PUNGS：222333444m 678p 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 24|
|25|全大 24|UPPER_TILES：777888m 789p 999s 88p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 25|
|26|全中 24|MIDDLE_TILES：444555m 456p 666s 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 26|
|27|全小 24|LOWER_TILES：111222m 123p 333s 22p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 27|
|28|清龙 16|PURE_STRAIGHT：123456789m CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 28|
|29|三色双龙会 16|THREE_SUITED_TERMINAL_CHOWS：123789m 123789p 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 29|
|30|一色三步高 16|PURE_SHIFTED_CHOWS：123234345m 789p 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 30|
|31|全带五 16|ALL_FIVES：345m 456p 567s 555m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 31|
|32|三同刻 16|TRIPLE_PUNG：222m 222p 222s 789m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 32|
|33|三暗刻 16|THREE_CONCEALED_PUNGS：222m 444p CCC 78s 55p 9s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 33|
|34|全不靠 12|LESSER_HONORS_AND_KNITTED_TILES：147m 258p 369s ESWNP|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 34|
|35|组合龙 12|KNITTED_STRAIGHT：147m 258p 369s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 35|
|36|大于五 12|UPPER_FOUR：678m 678p 789s 666p 88m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 36|
|37|小于五 12|LOWER_FOUR：123m 234p 234s 444p 22m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 37|
|38|三风刻 12|BIG_THREE_WINDS：EEE SSS WWW 123m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 38|
|39|花龙 8|MIXED_STRAIGHT：123m 456p 789s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 39|
|40|推不倒 8|REVERSIBLE_TILES：123p 345p 888s PPP 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 40|
|41|三色三同顺 8|MIXED_TRIPLE_CHOW：234m 234p 234s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 41|
|42|三色三节高 8|MIXED_SHIFTED_PUNGS：222m 333p 444s 789m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 42|
|43|无番和 8|CHICKEN_HAND：567p 789s 23s NN 4s|箭刻正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 43|
|44|妙手回春 8|LAST_TILE_DRAW：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 44|
|45|海底捞月 8|LAST_TILE_CLAIM：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 45|
|46|杠上开花 8|OUT_WITH_REPLACEMENT_TILE：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 46|
|47|抢杠和 8|ROBBING_THE_KONG：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 47|
|48|双暗杠 8|TWO_CONCEALED_KONGS：123s 678m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 48|
|49|碰碰和 6|ALL_PUNGS：222m 555p 999s 55m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 49|
|50|混一色 6|HALF_FLUSH：123456789m EEE 55m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 50|
|51|三色三步高 6|MIXED_SHIFTED_CHOWS：123m 234p 345s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 51|
|52|五门齐 6|ALL_TYPES：123m 456p 789s EEE CC|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 52|
|53|全求人 6|MELDED_HAND：55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 53|
|54|双箭刻 6|TWO_DRAGON_PUNGS：PPP CCC 123m 456p 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 54|
|55|全带幺 4|OUTSIDE_HAND：123m 789p 111s CCC EE|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 55|
|56|不求人 4|FULLY_CONCEALED_HAND：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 56|
|57|双明杠 4|TWO_MELDED_KONGS：123s 678m 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 57|
|58|和绝张 4|LAST_TILE：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 58|
|59|箭刻 2|DRAGON_PUNG：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 59|
|60|圈风刻 2|PREVALENT_WIND：123456m 789p EEE 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 60|
|61|门风刻 2|SEAT_WIND：123456m 789p SSS 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 61|
|62|门前清 2|CONCEALED_HAND：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 62|
|63|平和 2|ALL_CHOWS：234m 456p 678s 123p 55m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 63|
|64|四归一 2|TILE_HOG：123m 111m 456p 789s EE|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 64|
|65|双同刻 2|DOUBLE_PUNG：222m 222p 456s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 65|
|66|双暗刻 2|TWO_CONCEALED_PUNGS：222m CCC 12p 55s 3p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 66|
|67|暗杠 2|CONCEALED_KONG：123s 678m CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 67|
|68|断幺 2|ALL_SIMPLES：234m 456p 678s 222p 55m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 68|
|69|一般高 1|PURE_DOUBLE_CHOW：123123m 456p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 69|
|70|喜相逢 1|MIXED_DOUBLE_CHOW：123m 123p 456s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 70|
|71|连六 1|SHORT_STRAIGHT：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 71|
|72|老少副 1|TWO_TERMINAL_CHOWS：123789m 456p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 72|
|73|幺九刻 1|PUNG_OF_TERMINALS_OR_HONORS：111m 234p 567s CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 73|
|74|明杠 1|MELDED_KONG：123s 678m CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 74|
|75|缺一门 1|ONE_VOIDED_SUIT：123456m 789p CCC 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 75|
|76|无字 1|NO_HONORS：123456m 789p 222s 55p|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 76|
|77|边张 1|EDGE_WAIT：123456m CCC 55p 12s 3s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 77|
|78|坎张 1|CLOSED_WAIT：123456m CCC 55p 46s 5s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 78|
|79|单调将 1|SINGLE_WAIT：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 79|
|80|自摸 1|SELF_DRAWN：456p 234s 789s 66m|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 80|
|81|花牌 1|FLOWER_TILES：123456m 789p CCC 55s|合法无番和正例；反序/物理边界|scoring.ts 排除后择优；高风险15组独立断言|附件一 81|

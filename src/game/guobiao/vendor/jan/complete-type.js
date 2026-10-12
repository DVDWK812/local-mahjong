/*
Copyright 2021 masaue

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
export const COMPLETE_TYPE = {
    FINAL_DRAW_AND_WIN_ON_KONG: { tsumo: true, name: '妙手回春、槓上開花' },
    FINAL_DRAW: { tsumo: true, name: '妙手回春' },
    FINAL_DISCARD: { tsumo: false, name: '海底撈月' },
    WIN_ON_KONG: { tsumo: true, name: '槓上開花' },
    ROBBING_A_KONG: { tsumo: false, name: '搶槓' },
    DRAW: { tsumo: true, name: 'ツモ' },
    DISCARD: { tsumo: false, name: 'ロン' },
};

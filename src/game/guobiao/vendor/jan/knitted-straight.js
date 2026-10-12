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
import { Janpai } from './janpai';
import { JANPAI_ID } from './janpai-id';
export const KNITTED_STRAIGHT = {
    MPS: [new Janpai(JANPAI_ID.MAN_01),
        new Janpai(JANPAI_ID.MAN_04),
        new Janpai(JANPAI_ID.MAN_07),
        new Janpai(JANPAI_ID.PIN_02),
        new Janpai(JANPAI_ID.PIN_05),
        new Janpai(JANPAI_ID.PIN_08),
        new Janpai(JANPAI_ID.SOU_03),
        new Janpai(JANPAI_ID.SOU_06),
        new Janpai(JANPAI_ID.SOU_09)],
    MSP: [new Janpai(JANPAI_ID.MAN_01),
        new Janpai(JANPAI_ID.MAN_04),
        new Janpai(JANPAI_ID.MAN_07),
        new Janpai(JANPAI_ID.SOU_02),
        new Janpai(JANPAI_ID.SOU_05),
        new Janpai(JANPAI_ID.SOU_08),
        new Janpai(JANPAI_ID.PIN_03),
        new Janpai(JANPAI_ID.PIN_06),
        new Janpai(JANPAI_ID.PIN_09)],
    PSM: [new Janpai(JANPAI_ID.PIN_01),
        new Janpai(JANPAI_ID.PIN_04),
        new Janpai(JANPAI_ID.PIN_07),
        new Janpai(JANPAI_ID.SOU_02),
        new Janpai(JANPAI_ID.SOU_05),
        new Janpai(JANPAI_ID.SOU_08),
        new Janpai(JANPAI_ID.MAN_03),
        new Janpai(JANPAI_ID.MAN_06),
        new Janpai(JANPAI_ID.MAN_09)],
    PMS: [new Janpai(JANPAI_ID.PIN_01),
        new Janpai(JANPAI_ID.PIN_04),
        new Janpai(JANPAI_ID.PIN_07),
        new Janpai(JANPAI_ID.MAN_02),
        new Janpai(JANPAI_ID.MAN_05),
        new Janpai(JANPAI_ID.MAN_08),
        new Janpai(JANPAI_ID.SOU_03),
        new Janpai(JANPAI_ID.SOU_06),
        new Janpai(JANPAI_ID.SOU_09)],
    SMP: [new Janpai(JANPAI_ID.SOU_01),
        new Janpai(JANPAI_ID.SOU_04),
        new Janpai(JANPAI_ID.SOU_07),
        new Janpai(JANPAI_ID.MAN_02),
        new Janpai(JANPAI_ID.MAN_05),
        new Janpai(JANPAI_ID.MAN_08),
        new Janpai(JANPAI_ID.PIN_03),
        new Janpai(JANPAI_ID.PIN_06),
        new Janpai(JANPAI_ID.PIN_09)],
    SPM: [new Janpai(JANPAI_ID.SOU_01),
        new Janpai(JANPAI_ID.SOU_04),
        new Janpai(JANPAI_ID.SOU_07),
        new Janpai(JANPAI_ID.PIN_02),
        new Janpai(JANPAI_ID.PIN_05),
        new Janpai(JANPAI_ID.PIN_08),
        new Janpai(JANPAI_ID.MAN_03),
        new Janpai(JANPAI_ID.MAN_06),
        new Janpai(JANPAI_ID.MAN_09)],
};

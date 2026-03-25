'use client'
import Days from "@/components/math/lesson36/WeekdayFlowChart/Days";
import Month from "@/components/math/lesson36/WeekdayFlowChart/Month";


const LeftDiagram=()=>{
  return <>
    <Days startWeekday={1} startDate={'2021-04-21'} endDate={'2021-04-30'} />
    <Month startWeekday={1} startDate={'2021-04-21'} endDate={'2021-08-30'} />
  </>
}

export default LeftDiagram
